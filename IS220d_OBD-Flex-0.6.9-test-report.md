# IS220d OBD Flex 0.6.9 — koonti- ja testiraportti

Päivä: 8.9.2026

## Tulos

Flex 0.6.9 rakentui onnistuneesti. Node-testisarjan kaikki 102 testiä
läpäisivät. Sekä debug- että release-APK sisältävät uuden DPNR-tarkistusnäkymän.

## Uusi DPNR-tarkistus

- Ajossa tai tyhjäkäynnillä käytettävä oma näkymä Vgate vLinker MC+:lle.
- Samassa ruudussa DPNR-paine-ero, tulo- ja lähtölämpö, S- ja
  PM-regenerointitilat, polton aktiivisuus, RPM, jäähdytysneste, MAF ja jännite.
- `217E`- ja `217F`-raakavaste näytetään tulkitun arvon rinnalla.
- Täsmälleen samoista lämpötiloista sekä 750 °C:n kaksoislukemasta annetaan
  tarkistusvaroitus. Varoitus ei yksin tarkoita anturivikaa.
- Tallennuksen skeema 5 vie CSV:hen myös viimeisimmät `217E`, `217F` ja `212C`
  -raakavasteet.
- Techstreamin `DPF Thermal Deteriorate`, `DPF PM Block` ja `DPF No Activate`
  näytetään sovelluksessa tietoisena rajauksena: Flex ei tulkitse niitä ennen
  tunnisteen ja tavurakenteen autokohtaista varmistusta.

## Turvallisuusrajat

- Toyota-lukujen sallintalista on edelleen täsmälleen `217E`, `217F`, `212C`.
- DPNR-näkymä ei lähetä aktiivisia testejä, regenerointia, kirjoitusta tai
  vikakoodien poistoa.
- Quicklynks FFF0/FFF6 -binääripolku ja vLinker Classic/BLE -polut säilyvät
  erillisinä.
- Sovellus ei pyydä INTERNET-käyttöoikeutta ja
  `usesCleartextTraffic=false`.

## APK-varmennus

| Tarkistus | Tulos |
|---|---|
| packageId | `fi.oliver.is220dobd` |
| versionName / versionCode | `0.6.9` / `609` |
| minSdk / targetSdk | `21` / `34` |
| Testit | `102/102 PASS` |
| Allekirjoitus | Sama sertifikaatti kuin Flex 0.6.8 |
| Sertifikaatin SHA-256 | `1E:08:A9:03:AE:F9:C3:A7:21:51:0B:64:EC:76:4D:01:D3:D0:94:EB:95:41:61:B6:25:44:EA:8F:18:7B:59:53` |

## Tiedostot

| Tiedosto | Koko | SHA-256 |
|---|---:|---|
| `IS220d_OBD-Flex-0.6.9-release.apk` | 149 069 tavua | `db15d1a644c588185b0d097155c166da57b9cc3a379a8891a8a1b504c0060a1b` |
| `IS220d_OBD-Flex-0.6.9-debug.apk` | 165 453 tavua | `a61b8f8458afd3dd0a1b2afbf063d9f79c561171dd7ac5aa8aa874822783667e` |

## Autokokeen rajaus

Koonti on testattu ohjelmallisesti ja APK:n rakenne on tarkistettu. Fyysinen
IS220d + Vgate vLinker MC+ -koe tarvitaan vielä. Aloita DPNR-näkymässä
tyhjäkäynnillä, käynnistä DPNR-loki ja tee sen jälkeen normaali koeajo puhelin
telineessä. CSV:n raakavasteet mahdollistavat Techstream-lukemien riippumattoman
vertailun.
