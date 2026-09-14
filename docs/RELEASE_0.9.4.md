# Flex 0.9.4 · DPF/DPNR paine-eroanturin testi

## Uusi toiminto

DPNR-sivulle lisätään erillinen DPF/DPNR-paine-eroanturin toimintatarkistus. Se käyttää sovelluksessa jo varmennettua Toyota `217E` -paine-erosignaalia sekä nykyistä OBD-kierroslukua; uusia ECU-pyyntöjä ei lisätä.

Testi tallentaa kolme käyttötilaa:

1. KOEO, virrat päällä ja moottori sammuksissa, 5 s.
2. Vakaa tyhjäkäynti, 6 s.
3. Noin 3000 rpm ilman kuormaa, hyväksytty mittausikkuna 2700–3300 rpm, 6 s.

Jokaisesta vaiheesta tallennetaan paine-eron mediaani ja min/max, kierrosluvun mediaani, näytemäärä sekä viimeinen `217E`-raakavaste. Yhteenvedossa näytetään lisäksi tyhjäkäynnin ja 3000 rpm:n muutos KOEO-arvoon nähden.

## Tulkinta

Tulkinta noudattaa repossa jo dokumentoitua Lexus/Toyota GSIC RM0150 P1426 -diagnostiikkaevidenssiä. Negatiivinen DPNR-paine-ero noin 3000 rpm:ssa ilman kuormaa nostetaan selkeäksi poikkeamaksi. Tällöin raportti ohjaa tarkistamaan paineletkujen järjestyksen ja tukokset sekä pressure transmitting pipe -linjat ennen anturipäätelmää.

KOEO-arvo esitetään nollatason vertailuna. Flex ei lisää omaa numeerista kPa-hyväksymisrajaa. Ei-negatiivinen 3000 rpm -arvo merkitään havaituksi loogiseksi signaaliksi, ei todisteeksi siitä, että paine-eroanturi tai DPNR/DPF olisi varmasti kunnossa.

## Rajat

Toiminto on vain lukeva. Se ei lisää Active Test -komentoja, pakkoregenerointia, vikakoodien poistoa, vapaata komentoterminaalia tai ECU-kirjoituksia. Nykyinen `217E`-sallintalista ja sen dekoodaus säilyvät ennallaan.

Versio: `0.9.4` / Android `versionCode 904`.
