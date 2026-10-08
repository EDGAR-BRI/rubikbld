#!/usr/bin/env python3
"""
Script para convertir el mazo de Anki (.apkg) a un backup JSON compatible con RubikBLD.
Procesa notas, imágenes (convirtiendo y comprimiendo a WebP DataURLs) y el estado de repaso SRS.
"""

import sys
import os
import re
import io
import json
import base64
import zipfile
import sqlite3
import tempfile
import datetime
import subprocess
from PIL import Image

APKG_PATH = 'Notas seleccionadas-20261008000433.apkg'
OUTPUT_JSON = 'rubikbld_anki_backup.json'

def decompress_zstd(data: bytes) -> bytes:
    proc = subprocess.run(['zstd', '-d'], input=data, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Error al descomprimir con zstd: {proc.stderr.decode('utf-8', errors='ignore')}")
    return proc.stdout

def parse_media_protobuf(raw_media: bytes) -> list[str]:
    entries = []
    pos = 0
    while pos < len(raw_media):
        if raw_media[pos] != 10:
            break
        pos += 1
        length = 0
        shift = 0
        while True:
            b = raw_media[pos]
            pos += 1
            length |= (b & 0x7f) << shift
            if not (b & 0x80):
                break
            shift += 7
        
        entry_bytes = raw_media[pos:pos+length]
        pos += length
        
        if entry_bytes and entry_bytes[0] == 10:
            fn_len = entry_bytes[1]
            fn = entry_bytes[2:2+fn_len].decode('utf-8', errors='ignore')
            entries.append(fn)
    return entries

def normalize_front(raw: str) -> tuple[str, str, str]:
    """
    Normaliza el campo frontal (ej: '<h1><b>A-B</b></h1>', 'CHO', 'ch o', 'A-i')
    Retorna (primeraLetra, segundaLetra, parCompleto)
    """
    txt = re.sub(r'<[^>]+>', '', raw).strip().replace('&nbsp;', ' ')
    txt = txt.replace(' - ', '-').replace(' ', '-')
    parts = [p.strip().upper() for p in txt.split('-') if p.strip()]
    
    if len(parts) == 2:
        return parts[0], parts[1], f'{parts[0]}{parts[1]}'
    elif len(parts) == 1:
        s = parts[0]
        if s.startswith('CH') and len(s) > 2:
            return 'CH', s[2:], s
        elif s.endswith('CH') and len(s) > 2:
            return s[:-2], 'CH', s
        elif len(s) == 2:
            return s[0], s[1], s
        else:
            return s, '', s
    return '', '', txt

def parse_back(back_html: str) -> tuple[str, str | None, str]:
    """
    Extrae la palabra mnemotécnica, el nombre de archivo de la imagen y las notas.
    """
    img_match = re.search(r'<img[^>]+src=[\"\']([^\"\']+)[\"\']', back_html)
    img_name = img_match.group(1) if img_match else None
    
    clean = re.sub(r'<img[^>]*>', '', back_html)
    clean = re.sub(r'<(?:br|hr|div|p|\/div|\/p)[^>]*>', '\n', clean)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = clean.replace('&nbsp;', ' ').replace('&quot;', '\"').replace('&amp;', '&')
    
    lines = [line.strip() for line in clean.split('\n') if line.strip()]
    word = lines[0] if lines else ''
    notes = '\n'.join(lines[1:]) if len(lines) > 1 else ''
    return word, img_name, notes

def compress_image_to_webp(raw_img_bytes: bytes, max_size: int = 600, quality: int = 82) -> str:
    img = Image.open(io.BytesIO(raw_img_bytes))
    if img.mode in ('RGBA', 'LA') or ('transparency' in img.info):
        # Convertir con fondo blanco o RGB para ahorrar espacio si no hay alfa complejo
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'RGBA':
            background.paste(img, mask=img.split()[3])
        else:
            background.paste(img)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    w, h = img.size
    if w > h and w > max_size:
        h = round((h * max_size) / w)
        w = max_size
    elif h > max_size:
        w = round((w * max_size) / h)
        h = max_size
        
    if (w, h) != img.size:
        img = img.resize((w, h), Image.Resampling.LANCZOS)
        
    out = io.BytesIO()
    img.save(out, format='WEBP', quality=quality)
    b64 = base64.b64encode(out.getvalue()).decode('utf-8')
    return f'data:image/webp;base64,{b64}'

def main():
    if not os.path.exists(APKG_PATH):
        print(f"Error: No se encontró el archivo {APKG_PATH}")
        sys.exit(1)

    print(f"Abriendo {APKG_PATH}...")
    with zipfile.ZipFile(APKG_PATH, 'r') as z:
        print("Descomprimiendo índice de medios (media)...")
        raw_media = decompress_zstd(z.read('media'))
        media_entries = parse_media_protobuf(raw_media)
        media_map = {fn: str(idx) for idx, fn in enumerate(media_entries)}
        print(f"Archivos multimedia indexados: {len(media_map)}")

        print("Descomprimiendo base de datos Anki (collection.anki21b)...")
        anki_db_bytes = decompress_zstd(z.read('collection.anki21b'))
        
        with tempfile.NamedTemporaryFile(suffix='.db') as tmp:
            tmp.write(anki_db_bytes)
            tmp.flush()
            conn = sqlite3.connect(tmp.name)
            c = conn.cursor()
            
            c.execute('SELECT crt FROM col')
            crt = c.fetchone()[0] # Timestamp unix en segundos
            crt_ms = crt * 1000
            
            c.execute('''
                SELECT n.id, n.flds, c.type, c.queue, c.due, c.ivl, c.factor, c.reps, c.lapses
                FROM notes n
                JOIN cards c ON c.nid = n.id
                ORDER BY n.id ASC
            ''')
            rows = c.fetchall()
            print(f"Notas encontradas en Anki: {len(rows)}")

            pairs_list = []
            cards_list = []
            now_ms = int(datetime.datetime.now().timestamp() * 1000)

            print("Procesando pares, palabras e imágenes...")
            for idx, row in enumerate(rows):
                nid, flds_str, c_type, c_queue, c_due, c_ivl, c_factor, c_reps, c_lapses = row
                flds = flds_str.split('\x1f')
                front_raw = flds[0]
                back_raw = flds[1] if len(flds) > 1 else ''
                
                l1, l2, pair_id = normalize_front(front_raw)
                if not pair_id:
                    print(f"Advertencia: No se pudo normalizar frente en nota {nid}: {front_raw}")
                    continue

                word, img_name, notes = parse_back(back_raw)
                
                # Procesar imagen si existe
                image_data_url = None
                if img_name and img_name in media_map:
                    zip_entry_name = media_map[img_name]
                    try:
                        compressed_img_bytes = z.read(zip_entry_name)
                        decompressed_img = decompress_zstd(compressed_img_bytes)
                        image_data_url = compress_image_to_webp(decompressed_img)
                    except Exception as err:
                        print(f"Error procesando imagen {img_name} ({pair_id}): {err}")

                pair_item = {
                    "id": pair_id,
                    "pair": pair_id,
                    "usage": "both",
                    "firstLetter": l1,
                    "secondLetter": l2,
                    "word": word,
                    "image": image_data_url,
                    "notes": notes,
                    "createdAt": now_ms,
                    "updatedAt": now_ms
                }
                pairs_list.append(pair_item)

                # Estado SRS
                # Anki: type 0=new, 1=learning, 2=review, 3=relearning
                state = "new"
                due_timestamp = now_ms
                if c_type == 2:
                    state = "review"
                    # Anki: due en días desde la creación de la colección
                    due_timestamp = int((crt + (c_due * 86400)) * 1000)
                elif c_type in (1, 3):
                    state = "learning" if c_type == 1 else "relearning"
                    due_timestamp = now_ms
                else:
                    state = "new"
                    due_timestamp = now_ms

                ease_factor = round(c_factor / 1000.0, 2) if c_factor > 0 else 2.5
                if ease_factor < 1.3:
                    ease_factor = 1.3

                card_item = {
                    "id": pair_id,
                    "pair": pair_id,
                    "usage": "both",
                    "state": state,
                    "due": due_timestamp,
                    "interval": c_ivl if c_ivl > 0 else 0,
                    "easeFactor": ease_factor,
                    "stepIndex": 0,
                    "repetitions": c_reps,
                    "lapses": c_lapses,
                    "createdAt": now_ms
                }
                cards_list.append(card_item)

                if (idx + 1) % 50 == 0 or (idx + 1) == len(rows):
                    print(f"  [{idx + 1}/{len(rows)}] pares procesados...")

            # Construir payload de respaldo estándar de RubikBLD
            backup_payload = {
                "version": 1,
                "timestamp": now_ms,
                "appName": "RubikBLD",
                "data": {
                    "schemes": [],
                    "pairs": pairs_list,
                    "cards": cards_list,
                    "reviews": [],
                    "settings": []
                }
            }

            print(f"Guardando backup en {OUTPUT_JSON}...")
            with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
                json.dump(backup_payload, f, ensure_ascii=False)

            file_size_mb = os.path.getsize(OUTPUT_JSON) / (1024 * 1024)
            print(f"¡Listo! Se exportaron {len(pairs_list)} pares con éxito.")
            print(f"Tamaño del archivo generado: {file_size_mb:.2f} MB")

if __name__ == '__main__':
    main()
