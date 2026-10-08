---
name: rubik-bld-logic
description: >-
  Use this skill when implementing, debugging, or modifying 3x3 Blindfolded (3BLD) cubing logic,
  lettering schemes (Speffz), buffer assignments (UF / UFR), physical impossibility filters,
  and letter pair generation.
---

# Lógica y Reglas de Dominio 3x3 Blindfolded (3BLD)

Esta habilidad documenta las reglas matemáticas, físicas y de convención utilizadas en la resolución de Cubos de Rubik a Ciegas (3BLD) implementadas en Rubik BLD.

---

## 1. Convención de Caras y Colores

| Cara | Letra | Color Estándar | Color Hex (`FACE_COLORS`) |
| :--- | :---: | :--- | :--- |
| **Up** | `U` | Blanco | `#f8fafc` |
| **Left** | `L` | Naranja | `#ea580c` |
| **Front** | `F` | Verde | `#16a34a` |
| **Right** | `R` | Rojo | `#dc2626` |
| **Back** | `B` | Azul | `#2563eb` |
| **Down** | `D` | Amarillo | `#eab308` |

Cada cara de 3x3 tiene 9 pegatinas indexadas de `0` a `8` (en orden de lectura izquierda-derecha, arriba-abajo):
```text
 0 | 1 | 2
---+---+---
 3 | 4 | 5
---+---+---
 6 | 7 | 8
```

---

## 2. Esquema Speffz Estándar

En el esquema Speffz, a cada cara se le asignan 4 letras para aristas y 4 para esquinas, empezando en la cara `U` y siguiendo el orden `U, L, F, R, B, D`:

- **Aristas (12 piezas físicas, 24 pegatinas)**:
  - `U`: UB=A, UR=B, UF=C, UL=D
  - `L`: LU=E, LF=F, LD=G, LB=H
  - `F`: FU=I, FR=J, FD=K, FL=L
  - `R`: RU=M, RB=N, RD=O, RF=P
  - `B`: BU=Q, BL=R, BD=S, BR=T
  - `D`: DF=U, DR=V, DB=W, DL=X

- **Esquinas (8 piezas físicas, 24 pegatinas)**:
  - `U`: UBL=A, UBR=B, UFR=C, UFL=D
  - `L`: LUB=E, LUF=F, LDF=G, LDB=H
  - `F`: FLU=I, FRU=J, FRD=K, FLD=L
  - `R`: RFU=M, RBU=N, RBD=O, RFD=P
  - `B`: BRU=Q, BLU=R, BLD=S, BRD=T
  - `D`: DFL=U, DFR=V, DBR=W, DBL=X

### Soporte para Español (Dígrafos y Caracteres Especiales)
- Algunos cubistas hispanohablantes reemplazan letras (por ejemplo `W`, `X`) o añaden `CH` y `Ñ`.
- Siempre utilizar `splitPair()` y `isLetterToken()` de `src/models/cube.ts` para no romper tokens como `CH`.

---

## 3. Buffers y Exclusión

El **Buffer** es la posición fija desde donde el cubista lanza los ciclos de conmutadores (3-style u OP/M2):

1. **Buffer de Aristas por defecto**: `UF` (pegatina `U7` o `F1`).
2. **Buffer de Esquinas por defecto**: `UFR` (pegatina `U8`, `F2` o `R0`).

### Regla Fundamental de Limpieza de Buffers:
- **Toda la pieza del buffer físico queda sin letra**.
  - Si el buffer de aristas es `UF`, ni `U7` ni `F1` llevan letra.
  - Si el buffer de esquinas es `UFR`, ninguna de las 3 pegatinas (`U8`, `F2`, `R0`) lleva letra.
- Al modificar el buffer en `useSchemeStore.ts`, se debe ejecutar `cleanSchemeBufferLetters(scheme)` y luego `db.syncPairsWithScheme(cleaned)` para que los pares que involucraban al buffer se limpien automáticamente.

---

## 4. Filtro de Imposibilidad Física

En `src/services/pairGenerator.ts`:
- **Misma pieza**: Dos stickers situados en el mismo bloque plástico físico nunca pueden conmutarse como un par de letras.
- **Letras duplicadas**: Pares como `AA`, `BB` normalmente no existen porque una pieza no puede desplazarse a su misma posición en el mismo objetivo.
- La función `generateUnifiedPairs()` valida automáticamente estas condiciones contra la matriz tridimensional del cubo.
