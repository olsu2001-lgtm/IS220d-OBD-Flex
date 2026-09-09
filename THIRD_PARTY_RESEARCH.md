# Flex 0.7.2 · tutkimusaineiston hyödyntäminen

Flexin profiili-, transaktio-, replay-, pollaus- ja CT 200h -toteutus on
kirjoitettu itsenäisesti Flexin omaan lähdekoodiin. Alla olevia lähteitä
käytettiin rakenteen, kenttänimien, kaavojen, testitapojen ja
yhteensopivuusrajojen tutkimiseen.

0.7.2:n tehotestin ajanotto ja tehomalli on toteutettu itsenäisesti.
Androidin virallisista `LocationManager`- ja `Location`-rajapinnoista
varmistettiin GPS-palvelun, monotonisen ajan, nopeuden, nopeustarkkuuden ja
valesijaintitiedon käyttö. Lexus IS220d:n virallisesta esittely- ja
teknisestä aineistosta käytettiin vertailuarvoja 130 kW / 177 DIN hv,
0–100 km/h 8,9 s, Cd 0,27 ja omamassa 1585–1655 kg. Lexus CT 200h:n
virallisista teknisistä aineistoista käytettiin järjestelmätehoa 100 kW /
136 DIN hv, 0–100 km/h 10,3 s, Cd 0,29 ja omamassaa 1370 kg.

GPS-rajojen interpolointi, liike-energian, vierintävastuksen, kaltevuuden ja
ilmanvastuksen työmalli, robusti tehoikkuna sekä laatupisteytys on kirjoitettu
Flexiin ilman kolmannen osapuolen dynosovelluksen koodia. Malli raportoidaan
arviona, koska massa-, tuuli-, tien kaltevuus-, GPS- ja voimansiirto-oletukset
vaikuttavat tulokseen.

| Projekti | Lisenssi | Flexissä hyödynnetty idea | Lähdekoodia Flexissä |
|---|---|---|---|
| BETSY | MIT | Gen3-hybridin 7E2/7EA-osoitus, 2101/2181/2187/2195/2198-lukujen ja 0A/13B0-DTC-polun vertailu, replay- ja katkenneen datan testit | Ei kopioitu; kaavat toteutettu itsenäisesti |
| ObdMetrics / ObdGraphs | Apache-2.0 | deklaratiivinen profiili, lähdekohtaiset prioriteetit, vasteeseen mukautuva ajoitus ja mock-testaus | Ei kopioitu |
| ELM327-emulator | CC BY-NC-SA 4.0 | auton ulkopuolisten häiriötilojen testaus sekä Toyota Gen3 -jarruohjaimen 7B0/7B8-osoituksen tutkimuskandidaatti | Emulaattoria ei niputeta; koodia ei kopioitu ja Flexin toteutus on itsenäinen |
| universal-elm327-logger | GPL-3.0 | eräpäiväjono, saman lähteen mittarien fan-out, mittauskatolaskuri, multi-ECU-pollaus ja replay-testien käyttäytymisvertailu | Ei kopioitu |
| AndrOBD | GPL-3.0 | Android-kuljetusten, demotilan ja DTC-näkymän käyttäytymisvertailu | Ei kopioitu |
| RealDash-extras | Unlicense | profiilikenttien, yksiköiden ja muunnosmetadatan vertailu | Ajoneuvodata ei kopioitu |
| Nordic Android BLE Library | BSD-3-Clause | GATT-jonon ja MTU-/uudelleenyhdistysmallien vertailu | Ei lisätty riippuvuudeksi |

IS220d:n pyynnöt ja kaavat perustuvat projektissa aiemmin varmennettuun
2AD-FHV-aineistoon. CT 200h:n kenttäjoukko varmennettiin käyttäjän toimittaman
Techstream 12.20.024 -aineiston Data List -tietokannasta staattisella
tarkastelulla. Techstreamia ei käynnistetty eikä sen binäärejä, tietokantoja
tai Toyota/Lexus-korjausohjetiedostoja kopioida Flexin lähteeseen tai
jakelupaketteihin.

CT:n fyysinen rakenne tarkistettiin Toyota/Lexuksen purku- ja pelastusohjeesta:
201,6 V NiMH-akku, 28 sarjaan kytkettyä 7,2 V moduulia. Lexus-korjausohjeen
Data List -kuvaus vahvistaa Battery Smart Unitin 14 lohkojännitepaikkaa ja
nimet V01–V14. Sovellus ei päättele moduulikohtaista jännitettä 14
lohkoluvusta.

CT-profiili julkaisee vain arvoja, joille löytyi sekä ajoneuvon kenttänimi tai
rakenne että dokumentoitu protokollakaava. Ristiriitaisen kaavan vuoksi
`2181`-paketista ei julkaista 12 V apuakun jännitettä. Tuntemattomat tavut
jäävät raakavastaukseen. Yhtään kirjoitus-, Active Test-, koodaus-,
turva-avain-, vikakoodien poisto- tai pakkolatauskomentoa ei tuotu.

0.7.1:n ostotarkastuksen jarruohjainosoitusta `7B0`/`7B8` ei löytynyt
käytettävissä olleesta fyysisellä CT 200h:lla varmennetusta liikennejäljestä.
Se julkaistaan siksi vain `research-candidate`-tasolla, vain lukevana ja vain
ostotarkastuksen lisäkattavuuskokeena. Vastaamattomuus ei koskaan tarkoita
”ei vikakoodeja”, ja raportti ohjaa Techstream Health Checkiin. Oletus-
vikakoodiluku ei lähetä tätä tutkimuskandidaattia.

Lexuksen virallinen CSP 21LE01 vahvistaa 2011–2013 CT 200h:n brake booster / pump
assembly -tapauksissa tarkistettaviksi koodeiksi C1391, C1252, C1256 ja C1253.
L-SB-0028-13 ja Warranty Enhancement ZLF kuvaavat 2011–2012 CT 200h:n P0401-
sekä kylmäkäynnin rough idle / rattle -tapauksia. Näitä lähteitä käytetään
ostotarkastuksen huomioiden priorisointiin, ei ECU-komentojen tai
korjauspäätelmien arvaamiseen.

Keskeiset CT-lähteet:

- Toyota CT200h Dismantling Guide:
  https://techinfo.toyota.com/techInfoPortal/staticcontent/en/techinfo/html/prelogin/docs/ct200hdisman.pdf
- Lexus CT200h -korjausohjeen 14 lohkojännitteen Data List -kohta:
  https://jdmfsm.info/Auto/Japan/Lexus/CT200h/Lexus%20CT200h%20Service%20Manual/rm1720e/repair2/html/frame_rm0000025ai024x.html
- Lexus CT 200h:n moottori- ja hybriditekniset tiedot:
  https://media.lexus.co.uk/introducing-the-lexus-ct-200h-2/
- Lexus CT 200h:n 100 kW / 136 DIN hv ja 0–100 km/h 10,3 s -vertailu:
  https://newsroom.lexus.eu/the-refreshed-ct-200h/
- Lexus IS220d:n teho-, kiihtyvyys-, Cd- ja massatiedot:
  https://media.lexus.co.uk/introducing-the-new-lexus-is/
- Android `LocationManager`:
  https://developer.android.com/reference/android/location/LocationManager
- Android `Location`:
  https://developer.android.com/reference/android/location/Location
- BETSY, MIT-lisenssi:
  https://github.com/alrighdee/BETSY
- Lexus CSP 21LE01, brake booster / pump assembly:
  https://static.nhtsa.gov/odi/tsbs/2021/MC-10198146-9999.pdf
- Lexus L-SB-0028-13, P0401 / EGR:
  https://static.nhtsa.gov/odi/tsbs/2013/SB-10062364-2273.pdf
- Lexus Warranty Enhancement ZLF, cold-start rough idle / rattle:
  https://static.nhtsa.gov/odi/tsbs/2016/MC-10134094-9999.pdf

Tutkitut projektit:

- https://github.com/alrighdee/BETSY
- https://github.com/tzebrowski/ObdMetrics
- https://github.com/tzebrowski/ObdGraphs
- https://github.com/Ircama/ELM327-emulator
- https://github.com/bsdate-cc/universal-elm327-logger
- https://github.com/fr3ts0n/AndrOBD
- https://github.com/janimm/RealDash-extras
- https://github.com/NordicSemiconductor/Android-BLE-Library
