# Lexus OBD Flex 0.7.4 · testi- ja rakennusraportti

Päivä: 15.8.2026  
Lähdeversio: `0.7.4`

## Toteutettu

- Jokaisella ASCII-ELM327-/vLinker-yhteydellä ajettava automaattinen
  ajoneuvotunnistus.
- Mode 09 PID 02 -VIN-luku sekä ISO-TP- ja numeroitujen ELM-osavastausten
  parseri.
- CT 200h:n ZWA10- ja VIN-tunnistus.
- IS220d:n VIN- ja kaikkien 217E/217F/212C-lukuryhmien yhdistetty tunnistus.
- Varmuusluokat, ristiriidan esto, käsivalinnan varatila ja uusi
  **Tunnista auto uudelleen** -painike.
- Quicklynks FFF6:n todellinen rajoitus näytetään; valmistajakohtaisia
  komentoja ei arvata.

## Automaattitestit

Ajettu komennolla `node --test tests/*.test.mjs`.

| Tarkistus | Tulos |
|---|---:|
| Testejä | 145 |
| Hyväksytty | 145 |
| Hylätty | 0 |
| Ohitettu | 0 |

Uudet testit kattavat ISO-TP-VINin, numeroidut 49 02 -osavastaukset,
VIN-merkistön, IS220d- ja CT 200h -tunnistuksen, yhden lähteen vahvan näytön,
vajaan Toyota-vastauksen hylkäyksen, ristiriidan eston sekä atomisen vain luku
-VIN-komentojärjestyksen.

Lisäksi kaikki JavaScript-tiedostot tarkistettiin `node --check` -komennolla.
Simuloitu yhteystesti tuotti tuloksen:

```text
VIN: JTHBB262302028787
Ajoneuvo: is220d
Varmuus: confirmed
Lexus IS220d tunnistettu varmasti · XE20 · 2AD-FHV
```

## Turvallisuusrajat

- Uudet ajoneuvopyynnöt: vain `0902`, `21C1`, `217E`, `217F`, `212C`.
- VIN-luku ja Toyota-luvut ajetaan atomisissa jonoissa.
- Pyyntöotsake palautetaan `7E0`:aan.
- Ei uusia poisto-, kirjoitus-, Active Test-, turva-avain-, koodaus- tai
  pakkoregenerointikomentoja.
- Ei uusia Android-oikeuksia eikä verkkokoodia.
- `android.permission.INTERNET` ei kuulu `app.js`:n oikeuksiin.
- Pakettitunnus säilyy `fi.oliver.is220dobd`.

## APK-rakennuksen tila

Tämän ajon ympäristö esti `npm ci` -komennon myös offline-tilassa eikä
paikallisessa välimuistissa ollut lukittuja Nitron/Apktool/Esbuild-
rakennusriippuvuuksia. Aiemman APK:n allekirjoitusavainta ei ollut paikallisesti
saatavilla. Siksi 0.7.4-APK:ta ei rakennettu eikä allekirjoituksesta,
manifestin lopullisesta versionCodesta tai asennuspäivityksestä esitetä
virheellistä hyväksyntää.

Lähdeprojektin tavoitearvot ovat `versionName 0.7.4` ja `versionCode 704`.
APK pitää rakentaa projektin lukitulla `npm ci && npm test && npm run build`
-polulla ympäristössä, jossa riippuvuudet ovat saatavilla, ja sen jälkeen
varmentaa samalla SHA-256-sertifikaatilla kuin 0.7.3:
`1E:08:A9:03:AE:F9:C3:A7:21:51:0B:64:EC:76:4D:01:D3:D0:94:EB:95:41:61:B6:25:44:EA:8F:18:7B:59:53`.
