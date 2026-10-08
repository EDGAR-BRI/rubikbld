#!/usr/bin/env python3
"""
Script de utilidad para extraer y parsear mazos de Anki (.apkg) y convertirlos
al formato compatible con la base de datos Dexie.js de Rubik BLD.
"""

import sys
import os
import json
import sqlite3
import zipfile
import tempfile
import subprocess
import re
from pathlib import Path

DIGRAPH_LETTERS = ["CH"]

def normalize_pair_front(raw_text: str):
    """
    Limpia etiquetas HTML y normaliza el texto frontal (par de letras)
    Soporta formatos tipo: 'A - B', 'AB', 'CH - O', 'CHO', etc.
    """
    clean = re.sub(r'<[^>]+>', '', raw_text).strip().replace('&nbsp;', ' ')
    clean = clean.replace(' - ', '-').replace(' ', '-')
    parts = [p.strip().upper() for p in clean.split('-') if p.strip()]

    if len(parts) >= 2:
        return parts[0], parts[1], f"{parts[0]}{parts[1]}"
    elif len(parts) == 1:
        s = parts[0]
        for d in DIGRAPH_LETTERS:
            if s.startswith(d) and len(s) > len(d):
                return d, s[len(d):], s
            if s.endswith(d) and len(s) > len(d):
                return s[:-len(d)], d, s
        if len(s) == 2:
            return s[0], s[1], s
        return s, "", s
    return "", "", clean

def extract_anki_deck(apkg_path: str, output_json: str = None, media_dir: str = None):
    apkg_file = Path(apkg_path)
    if not apkg_file.exists():
        print(f"Error: El archivo {apkg_path} no existe.", file=sys.stderr)
        sys.exit(1)

    print(f"Abriendo mazo: {apkg_file.name}")
    with zipfile.ZipFile(apkg_file, 'r') as z:
        # 1. Obtener base de datos SQLite
        db_bytes = None
        if 'collection.anki21b' in z.namelist():
            raw = z.read('collection.anki21b')
            decomp = subprocess.run(['zstd', '-d'], input=raw, capture_output=True)
            if decomp.returncode == 0:
                db_bytes = decomp.stdout
        if not db_bytes and 'collection.anki2' in z.namelist():
            db_bytes = z.read('collection.anki2')

        if not db_bytes:
            print("Error: No se encontró la base de datos de colección en el archivo .apkg", file=sys.stderr)
            sys.exit(1)

        # 2. Leer mapa de medios si se solicita extraer imágenes
        media_map = {}
        if 'media' in z.namelist():
            raw_media = z.read('media')
            if raw_media[:4] == b'\x28\xb5\x2f\xfd':
                decomp_media = subprocess.run(['zstd', '-d'], input=raw_media, capture_output=True).stdout
            else:
                decomp_media = raw_media

            try:
                media_map = json.loads(decomp_media.decode('utf-8'))
            except Exception:
                # Formato protobuf: indexar nombres por aparición secuencial
                matches = re.findall(rb'([0-9a-zA-Z_\.\-]+\.(?:jpg|jpeg|png|webp|gif|svg))', decomp_media)
                for idx, m in enumerate(matches):
                    media_map[str(idx)] = m.decode('utf-8', errors='ignore')

        # 3. Consultar notas SQLite
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
            tmp.write(db_bytes)
            tmp_db_path = tmp.name

        conn = sqlite3.connect(tmp_db_path)
        cur = conn.cursor()
        cur.execute("SELECT flds FROM notes")
        notes = cur.fetchall()
        conn.close()
        os.unlink(tmp_db_path)

        pairs_data = []
        for (flds_str,) in notes:
            fields = flds_str.split('\x1f')
            front_raw = fields[0] if len(fields) > 0 else ""
            back_raw = fields[1] if len(fields) > 1 else ""

            l1, l2, pair_id = normalize_pair_front(front_raw)
            if not pair_id or not l1:
                continue

            # Extraer palabra mnemotécnica (limpiando tags)
            clean_back = re.sub(r'<[^>]+>', ' ', back_raw)
            clean_back = re.sub(r'\s+', ' ', clean_back).strip()

            # Extraer nombre de imagen referenciada si existe
            img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', back_raw)
            img_name = img_match.group(1) if img_match else None

            pairs_data.append({
                "id": pair_id,
                "pair": pair_id,
                "firstLetter": l1,
                "secondLetter": l2,
                "word": clean_back,
                "imageFilename": img_name,
                "updatedAt": 0
            })

        print(f"✓ Extraídas {len(pairs_data)} notas válidas.")

        if output_json:
            with open(output_json, 'w', encoding='utf-8') as f:
                json.dump(pairs_data, f, ensure_ascii=False, indent=2)
            print(f"✓ Guardado JSON en: {output_json}")

        if media_dir and media_map:
            out_media_path = Path(media_dir)
            out_media_path.mkdir(parents=True, exist_ok=True)
            saved_count = 0
            # Invertir mapa para buscar por nombre de archivo
            name_to_id = {v: k for k, v in media_map.items()}
            for item in pairs_data:
                img_name = item.get("imageFilename")
                if img_name and img_name in name_to_id:
                    zip_id = name_to_id[img_name]
                    if zip_id in z.namelist():
                        data = z.read(zip_id)
                        target_file = out_media_path / img_name
                        with open(target_file, 'wb') as mf:
                            mf.write(data)
                        saved_count += 1
            print(f"✓ Extraídas {saved_count} imágenes asociadas en: {media_dir}")

        return pairs_data

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 extract_apkg.py <archivo.apkg> [salida.json] [dir_imagenes]")
        sys.exit(1)

    apkg = sys.argv[1]
    out_json = sys.argv[2] if len(sys.argv) > 2 else "extracted_pairs.json"
    out_media = sys.argv[3] if len(sys.argv) > 3 else None

    extract_anki_deck(apkg, out_json, out_media)
