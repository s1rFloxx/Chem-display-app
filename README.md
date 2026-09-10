# ChemViewer 3D – upravená verze

## Co jsem změnil
- Molekuly jsou v samostatném `molecules.json`.
- Každá položka má název, vzorec, molární hmotnost, hybridizaci, geometrii a úhel.
- Dvojné vazby se vykreslují dvěma válci.
- Volný elektronový pár se vykresluje dvěma malými bílými sférami.
- Přidána legenda barev atomů.
- Zachován import `.XYZ`.
- `script.js` je nyní podrobně okomentovaný pro učení/odevzdání.

## Spuštění
Protože se `molecules.json` načítá přes `fetch()`, doporučuji lokální server:

```bash
python -m http.server 8000
```

Pak otevři `http://localhost:8000/`.

## Offline Three.js
Projekt stále používá Three.js 0.160.0 z CDN. Three.js je pod MIT licencí, takže
jeho lokální uložení a použití je možné při zachování licence/copyrightu.

Přidal jsem `download-three.sh` a `download-three.ps1`, které stáhnou:
- `three.module.js`
- `OrbitControls.js`
- `LICENSE`

Do `vendor/three/`.

V tomto sandboxu se mi nepodařilo stáhnout samotné JS soubory z CDN (síťový přístup
pro souborové stahování zde není dostupný), proto je nedodávám falešně jako stažené.
Skript pro jejich stažení je ale připravený.

Po stažení změň importmap v `index.html` na:

```json
{
  "imports": {
    "three": "./vendor/three/build/three.module.js",
    "three/addons/": "./vendor/three/examples/jsm/"
  }
}
```

## Důležitá poznámka k „Chloridu barnatému“
Zadání uvádí „Chlorid barnatý (h: sp2, tvar: rovnostranný trojúhelník/trigonální)“.
BaCl₂ má ale pouze dva chloridy, takže tento třívrcholový trigonální model nesedí
na vzorec BaCl₂. Neopravil jsem to potají: položka zůstává podle zadání a aplikace
zobrazí upozornění. Ověř u učitele, zda nemělo jít o BCl₃ (chlorid boritý).

## Přesnost modelů
Souřadnice vestavěných molekul jsou nastavené podle požadovaných školních úhlů.
Nejde o kvantově vypočtené optimalizované struktury.
