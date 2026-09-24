# Muutoshistoria

## Julkaisuvalmistelu · käyttöliittymä ja DPNR · 24.9.2026

- Korjattu 0.9.7:n paketointivirhe: uuden mobiilikäyttöliittymän tyylitiedosto
  sisältyy molempiin APK:ihin. Julkaisutarkistus vertaa tyylejä lähdetiedostoihin.
- Korjattu Lisää-valikon BOM-linkki sekä sivujen avaaminen niin, että Live-,
  DPNR- ja tallennettujen ajojen näkymät suorittavat omat päivitystoimintonsa.
- Yhdistetty Health/Live-näkymän ja viitevertailun päivitys samaan vaiheeseen.
  Käyttöliittymän omat DOM-muutokset eivät enää ylläpidä jatkuvaa piirto-silmukkaa.
- Tuotu PR #54:n DPNR-mittaus suoraan lähdekoodiin. Molemmat ohjatut testit
  lukevat tuoreen 217E-vastauksen sekä RPM:n; raakamuotoinen varareitti säilyy.
- Pohjana rekisteröity 0.9.7 ja PR #53:n myöhempi DPF/EGR-vertailutyö.
  Säilytetty neljä päävälilehteä ja nykyinen ECU Survey -kautta toimiva
  komponenttitulosten julkaisu; rinnakkaista käyttöliittymäkuorta ei lisätty.
- vLinkerin Classic-parituksen palautus ja vastaamattoman 219C-suutinkyselyn
  esto säilyvät. Todellisen auton DPF/EGR-varmennus on edelleen tekemättä.

## Kehitys · DPF/EGR Techstream-capture

- Lisätty passiivinen Techstream/J2534-tutkimuspolku oikean DPF Differential
  Pressure- ja EGR Lift Sensor Output -transaktion tunnistamiseen ilman uusia
  autolle lähetettäviä komentoja.
- Techstream CSV/text -importti poimii nyt DPF-paineen, EGR-liftin, RPM:n ja
  MAFin sekä säilyttää aikasarjarivit.
- J2534-jälkianalyysi hyväksyy 7E0/7E8-kompaktimuodon sekä nelitavuisen CAN-ID:n
  sisältävän lokimuodon ja luokittelee nykyiset, hylätyt ja uudet read-only
  kandidaatit erikseen.
- Lisätty vaiheittainen DPF/EGR-capture-bundle ja offline-korrelaatio, joka
  etsii 8-/16-bittisiä tavukanavia ja lineaarisia skaalaehdokkaita. Tulos ei
  koskaan muuta sallintalistaa eikä merkitse signaalia tuotantovarmennetuksi.
- Lisätty dokumentoitu target-vehicle-portti: Techstream/J2534-capture,
  toistuva numeerinen vertailu ja kolme Flex-varmennusajoa ennen live-julkaisua.
- Ei versionumeron muutosta eikä APK-julkaisua.

## 0.9.3 · Yhtenäinen versiointi ja julkaisulukko

- Versio tulee vain package.json-tiedostosta APK:hon, näkyvään käyttöliittymään
  ja diagnostiikkaraportteihin. Androidin versionCode on 903.
- Poistettu kiinteät 0.8.1-APK-nimet ja vanhoja tiedostoja säilyttävä jälkinimeäminen.
- Kaikki haarat tarkistavat yhteisen GitHub-julkaisurekisterin. Tunnisteet
  0.9.2:een asti on suljettu; jokainen uusi toimitus rekisteröi SHA-256-tiivisteet.
- Valmiiden debug- ja release-APK:iden versiot, allekirjoitukset, sisältö ja
  lähdekoodin commit tarkistetaan ennen rekisteröintiä ja jakamista.
- Pohja on toimitettu 0.9.2 / 40fc602b74877e659170341418840f2c49e22a29.
  Ajoneuvoprotokollia tai anturitulkinnoita ei muuteta.

## 0.8.1 · Suutintestin fail-closed-korjaus

- Estää kentässä vastaamattoman Toyota `219C` -pyynnön ennen kuljetusta
  kalibroinnilla `35360000`.
- Näyttää selkeän `EI TUETTU`-tilan 45 sekunnin suutintestin sijaan, kunnes
  oikea Techstream Data List -tunniste on varmennettu.
- Vapauttaa testiraportin ja käyttöliittymän ennen lyhyeksi rajattua
  ELM/CAN-palautusta, jotta virhepolku ei jää näyttämään käynnissä olevalta.
- Päivittää version arvoihin `0.8.1` / `versionCode 801`.

## 0.8.0 · Yhdistetty kenttätestiversio

- Palautettu 0.6.9-kehityslinjan Field Test Mode, kolmen ajon ECU Survey
  -historia, Techstream-vertailu ja Evidence Support Bundle v1 nykyisen
  moniajoneuvoisen käyttöliittymän päälle.
- Säilytetty 0.7.5:n teemat, alanavigaatio, Bluetooth-korjaukset ja paketoidun
  WebView-käyttöliittymän savutesti.
- Säilytetty 0.7.7:n noin 45 sekunnin vain lukeva suutinten tasapainoseulonta
  sekä tekoälylle jaettava TXT-raportti.
- Korjattu suutintestin näennäinen jäätyminen: `219C` tarkistetaan ennen koko
  testiä, eteneminen näytetään komentokohtaisesti ja toistuviin puuttuviin
  vastauksiin katkaistaan hallitusti virheilmoituksella.
- Korjattu Live-kuvaajan korkeus, joka kertautui laitteen pikselitiheyden
  mukaan jokaisella uudelleenpiirrolla.
- Laaja diagnostiikka kokeilee nykyisen yhteyden `0100`-lukua ennen adapterin
  capability-kyselyjä ja mahdollista nollausta.
- Pakettitunnus ja allekirjoitusidentiteetti säilyvät ennallaan. Versio on
  `0.8.0` / `versionCode 800`, jotta APK asentuu Flex 0.7.7:n päälle.

## 0.7.8 · DPNR-tarkistus ja asennusjärjestyksen korjaus

- Lisätty IS220d-profiilille oma DPNR-tarkistusnäkymä, joka näyttää Toyota
  `217E`-paine- ja regenerointitilat sekä `217F`-pakolämpötilat tulkittuina ja
  ECU:n raakavastauksina.
- Lisätty RPM:n, jäähdytysnesteen, MAF:n ja jännitteen samanaikainen seuranta,
  DPNR-kuvaaja sekä 750/750 °C -rajatilan näkyvä varoitus.
- DPNR-loki käyttää samaa jatkuvaa koeajotallennusta ja säilyttää jokaisessa
  näytteessä myös viimeisimmät täydet raakavastaukset CSV-vientiä varten.
- Techstreamin `Thermal Deteriorate`, `PM Block` ja `No Activate` jätetään
  tarkoituksella tulkitsematta, kunnes niiden tunnisteet on varmennettu.
- Versionumero jatkuu aiemman Flex 0.7.7:n jälkeen (`versionCode 708`), jotta
  Android hyväksyy päivityksen eikä tulkitse sitä versiopalautukseksi.

## 0.7.7 · IS220d-suutintesti ja tekoälyraportti

- Lisätty vain lukeva IS220d / 2AD-FHV -suutinten tasapaino- ja
  vuotoepäilyseulonta lämpimälle vakaalle tyhjäkäynnille.
- Testi kerää standardit `010C`/`0105`-arvot sekä Techstreamista johdetut
  `2193`-polttoainelämpö-, `2196`-rail-paine- ja `219C`-suutinkorjausarvot.
- Raportissa ovat näytekohtaiset raakavastaukset, olosuhteet,
  sylinterikohtaiset tilastot, käsikirjan ±3,0 mm³ tavanomainen alue,
  4,9 mm³ huoltoraja sekä valmiit tekoälyn analyysiohjeet.
- Korjausarvoseulontaa ei esitetä varmana vuotodiagnoosina: käyttöliittymä ja
  raportti ohjaavat tarvittaessa paluuvirta-/leak-off-testiin,
  puristusmittaukseen ja korkeapainepuolen vuototarkastukseen.
- Korjattu tunnistamattoman auton laaja raportti niin, ettei se enää nimeä
  ajoneuvoa virheellisesti IS220d:ksi.
- Quicklynks-polku ei lähetä Toyota 21xx -kyselyitä; suutintesti vaatii
  vLinker- tai muun ASCII-ELM327-adapterin.

## 0.7.5 · WebView-käynnistyksen ja käyttöliittymän korjaus

- Korjattu esbuild-paketoijan rikkoma teemamoduulin oletusparametri, joka
  aiheutti APK:ssa käynnistysvirheen `_c is not defined`.
- Teeman vaihto, alanavigaatio ja Bluetooth-laitelistan muodostaminen toimivat
  jälleen, koska käyttöliittymän tapahtumankäsittelijät rekisteröityvät.
- APK-rakennus ajaa nyt sekä debug- että release-bundlelle todellisen
  käyttöliittymän savutestin. Julkaisu estetään, elleivät teeman vaihto,
  Live-sivulle navigointi ja Bluetooth-listan päivitys toimi paketoidulla
  `app.bundle.js`-tiedostolla.
- 0.7.4:n automaattinen ajoneuvotunnistus ja kaikki aiemmat vain luku
  -diagnostiikkapolut säilyvät.

## 0.7.4 · Yhdistetyn auton automaattinen tunnistus

- Ajoneuvon automaattinen tunnistus on nyt uusissa asennuksissa oletus.
  Tunnistus ajetaan jokaisella tavallisen ASCII-ELM327:n tai vLinker MC+:n
  Classic/BLE-yhteyskerralla myös silloin, kun käyttäjä on tallentanut
  käsivalinnan; käsivalinta toimii vain tunnistuksen varaprofiilina.
- Lisätty standardin Mode 09 PID 02 VIN-luku. Parseri tukee otsakkeellista
  ISO-TP-monikehystä sekä ELM327:n numeroituja 49 02 -osavastauksia ja
  hyväksyy vain 17-merkkisen VIN-merkistön.
- CT 200h varmennetaan ZWA10-hybridiohjaimen mallitunnisteella ja tunnetulla
  CT-VIN-etuliitteellä. IS220d varmennetaan tunnetulla IS-VIN-etuliitteellä
  sekä kaikkien kolmen 2AD-FHV-lukuryhmän 217E/217F/212C vastauksilla.
- Ristiriitaiset VIN- ja ECU-tiedot estävät automaattisen profiilinvaihdon.
  Puuttuvan näytön tapauksessa appi käyttää nimenomaisesti käsin valittua
  varaprofiilia tai jää yleiseen EOBD-tilaan; tunnistuksen voi ajaa uudelleen
  Yhteys-sivulta.
- Quicklynks FFF6:n binääripolulle ei lisätty arvaavaa VIN- tai Toyota-
  komentokuorta. Appi kertoo tunnistuksen rajoituksesta ja käyttää siinä
  käsivalintaa; varmennettu yleinen Quicklynks-OBD-luku säilyy ennallaan.
- Tunnistus käyttää vain kiinteitä lukukomentoja (`0902`, `21C1`, `217E`,
  `217F`, `212C`), atomisia ECU-transaktioita ja palauttaa pyyntöotsakkeen
  `7E0`:aan. Kirjoitus-, poisto-, Active Test- tai pakkoregenerointikomentoja
  ei lisätty.
- Lisätty VIN-parserin, tunnistusvarmuuden, ristiriitojen, osavastausten ja
  atomisen vain luku -komentojärjestyksen regressiotestit.
- Säilytetty pakettitunnus `fi.oliver.is220dobd`, aiempi allekirjoitus,
  `minSdk 21` / `targetSdk 34`, internetoikeuden puuttuminen ja
  `usesCleartextTraffic=false`.
- Versionumero nostettu arvoihin `versionName 0.7.4` ja `versionCode 704`.

## 0.7.3 · Vaihdettavat teemat

- Lisätty Yhteys-sivulle saavutettava teemavalitsin ja kuusi erillistä
  väripalettia: Lexus Dark, Pearl Light, OLED Black, Hybrid Blue, F Sport Red
  ja Korkea kontrasti. Seitsemäs Järjestelmä-valinta seuraa Androidin vaaleaa
  tai tummaa tilaa automaattisesti.
- Teemavalinta tallennetaan paikallisesti ja otetaan käyttöön jo ennen
  käyttöliittymän ensimmäistä piirtoa. Valinta säilyy sovelluksen sulkemisen,
  puhelimen uudelleenkäynnistyksen ja Flex-päivityksen yli.
- Uudistettu käyttöliittymän värirakenne semanttisiksi muuttujiksi. Teeman
  korostusväri vaihtuu, mutta onnistumisen, varoituksen, virheen ja tiedotteen
  merkitysvärit säilyvät erillisinä kaikissa paleteissa.
- Live-datan, tallennettujen ajojen ja Tehotestin Canvas-kuvaajat lukevat
  teemavärit CSS-muuttujista ja piirretään uudelleen heti teeman vaihtuessa.
- Sovelluksen `theme-color` ja selaimen/WebViewin `color-scheme` päivittyvät
  valitun tai järjestelmästä ratkaistun teeman mukaan.
- Lisätty kuusi teemien yksikkö-, integraatio-, pysyvyys-, järjestelmäseuranta-
  ja kontrastitestiä. Jokaisen paletin perusteksti, himmeä teksti ja
  pääpainike tarkistetaan WCAG AA -kontrastirajaa vasten. Koko sarja sisältää
  135 hyväksyttyä testiä.
- Säilytetty pakettitunnus `fi.oliver.is220dobd`, aiempi allekirjoitus,
  `minSdk 21` / `targetSdk 34`, internetoikeuden puuttuminen ja
  `usesCleartextTraffic=false`. Teematoiminto ei lisää Android-oikeuksia eikä
  ECU-komentoja.
- Versionumero nostettu arvoihin `versionName 0.7.3` ja `versionCode 703`.

## 0.7.2 · GPS/OBD Power Test

- Lisätty oma Tehotesti-sivu automaattisille 0–100 km/h-, 80–120 km/h-,
  0–60 mph- ja 60–120 km/h -mittauksille sekä vapaasti määritettävälle
  nopeusvälille. Nopeusrajojen ylitykset interpoloidaan GPS-näytteiden
  väliin, ja tulokseen muodostetaan soveltuvat väliajat.
- Lisätty natiivi Android-GPS-silta, joka käyttää GPS-palvelua ja monotonista
  `elapsedRealtimeNanos`-aikaa. Silta välittää nopeus-, korkeus-, suunta-,
  tarkkuus- ja valesijaintitiedot mutta ei leveys- tai pituusastetta.
- Lisätty fysikaalinen tehoarvio liike-energialle, vierinnälle, tien
  kaltevuudelle ja ilmanvastukselle. Raportti erottaa keski- ja
  huippupyörätehon sekä voimansiirtohäviöllä korjatun IS220d-moottoritehon tai
  CT 200h -järjestelmätehon. Huippuarvio käyttää noin sekunnin ikkunoiden 90.
  persentiiliä.
- Lisätty muokattavat massa-, kaltevuus-, lämpötila-, ilmanpaine-, Cd-,
  otsapinta-ala-, vierintävastus- ja voimansiirtohäviöasetukset. Mukana ovat
  IS220d:n 130 kW / 177 DIN hv ja 8,9 s sekä CT 200h:n 100 kW / 136 DIN hv ja
  10,3 s viralliset vertailuarvot.
- OBD on tehotestissä vapaaehtoinen. Yhdistettynä se tallentaa nykyisen
  turvallisen livepolun nopeus-, kierrosluku-, kuormitus- ja tehoarvoja GPS:n
  rinnalle; uusia ECU-pyyntöjä tai kirjoitustoimintoja ei lisätty.
- Lisätty laatupisteet näytetaajuudelle, näyteväleille, GPS-tarkkuudelle,
  ajosuunnalle, GPS/OBD-erolle ja valesijainnille. Heikko tulos voidaan
  raportoida kiihtyvyytenä, mutta sitä ei hyväksytä tehovertailuun.
- Lisätty reititön TXT-/CSV-vienti, analyysipyyntö ja enintään 12 saman auton
  sekä saman testivälin tuloksen paikallinen vertailuhistoria.
- Lisätty 10 tehotestin yksikkö-/integraatiotestiä ja yksi Android/APK-
  lähdetarkistus. Koko sarja sisältää 129 hyväksyttyä testiä.
- Säilytetty pakettitunnus `fi.oliver.is220dobd`, aiempi allekirjoitus,
  `minSdk 21` / `targetSdk 34`, internetoikeuden puuttuminen ja
  `usesCleartextTraffic=false`. `ACCESS_FINE_LOCATION` tarvitaan GPS-
  nopeusmittaukseen sekä vanhempien Android-versioiden BLE-hakuun.
- Versionumero nostettu arvoihin `versionName 0.7.2` ja `versionCode 702`.

## 0.7.1 · CT 200h Purchase Inspection

- Lisätty CT 200h -profiilille nelivaiheinen ostotarkastus: kohdetiedot ja
  manuaaliset havainnot, paikallaan tehtävä esitarkastus, ohjattu HV-akun
  koeajo sekä TXT-raportti.
- Esitarkastus lukee EOBD readiness/MIL-tiedot, Mode 03/07/0A-koodit,
  jäähdytysnesteen, kierrosluvun, STFT/LTFT:n, EGR-arvot, lämpenemiskerrat ja
  matkan koodien nollauksesta, ohjainlaitteen jännitteen sekä CT-profiilin
  ZWA10/HV-lukupaketit ja hybridikoodit.
- Lisätty kokeellinen, vain lukeva jarru-/luistonesto-ohjaimen DTC-kattavuus
  otsakkeilla `7B0`/`7B8` ja pyynnöllä `13B0`. Tutkimuskandidaatti on oletus-
  DTC-luvussa pois käytöstä ja aktivoituu vain ostotarkastuksessa. Vain
  kelvollinen `53`-vastaus hyväksytään; vastaamattomuus merkitään
  kattavuuspuutteeksi eikä koodittomaksi tulokseksi.
- Usean ECU:n DTC-luku ryhmittelee pyynnöt atomisiin otsaketransaktioihin,
  puhdistaa vastaanottosuodattimen ja palauttaa jokaisen CT-transaktion
  jälkeen `ATSH7E0`-otsakkeen.
- Lisätty tuoreusvaatimuksella toimiva HV-näytteenotto. Näyte hyväksytään vain,
  kun kaikki 14 lohkojännitettä ja akkuvirta ovat saatavilla ja enintään
  2,2 sekunnin ikäisiä. Automaattiset vaiheet ovat paikallaan, purku,
  regenerointi ja tulokseen kuulumaton siirtymä.
- Lisätty läpinäkyvä analyysi ilman akun kapasiteetti- tai SOH-prosenttia.
  Raportti erottaa Flexin seulontarajat OEM-vikarajoista ja käsittelee
  kattavuuden, readinessin, tuoreen nollauksen, lohkopoikkeaman, lämpötilan,
  vastushajonnan sekä keskeiset hybridi-, jarru-, EGR- ja misfire-koodit.
- Valmis kattavuus vaatii vähintään 10 minuutin testijakson. Raportin
  muodostus lukee EOBD- ja hybridikoodit uudelleen koeajon jälkeen; puuttuva
  uusintaluku jättää tuloksen keskeneräiseksi.
- Lisätty viisi ostotarkastuksen regressiotestiä. Koko sarja sisältää 118
  hyväksyttyä testiä.
- Säilytetty pakettitunnus `fi.oliver.is220dobd`, aiempi allekirjoitus,
  `minSdk 21` / `targetSdk 34`, internetoikeuden puuttuminen ja
  `usesCleartextTraffic=false`.
- Versionumero nostettu arvoihin `versionName 0.7.1` ja `versionCode 701`.

## 0.7.0 · Lexus CT 200h Hybrid

- Sovellus nimettiin Lexus OBD Flexiksi ja siihen lisättiin Lexus CT 200h /
  ZWA10 sekä automaattinen ajoneuvotunnistus. IS220d säilyy oletusvalintana,
  jotta nykyisen 0.6.8-asennuksen käyttäytyminen ei muutu päivityksessä.
- Lisätty validoitu ja syväjäädytetty
  `ct200h-zwa10-gen3-hybrid-readonly-v1`-profiili: hybridiohjain 7E2/7EA,
  2ZR-FXE, 201,6 V NiMH, 14 lohkoa ja 28 moduulia.
- Lisätty ZWA10-mallitunnisteen `21C1`-luku. Automaatti ei päättele CT:tä
  pelkästä geneerisestä hybridivastauksesta.
- Lisätty 52 suoraa CT-hybridimittaria komennoista `2101`, `2181`, `2187`,
  `2195` ja `2198`: SOC, 14 lohkojännitettä ja yhteenveto, imuilma ja TB1–TB3,
  14 sisäistä vastusta ja yhteenveto, akkuvirta, tehorajat ja SOC-arvot.
  Johdettu akun teho nostaa CT-näkymän kokonaismäärän 53 mittariin.
- Lisätty CT-ajonäkymä, ajoneuvokohtainen live-suodatus, dynaamiset raportit,
  ajoneuvo/profiili CSV-metatiedot ja CT:tä koskeva analyysipyyntö.
- Lisätty hybridiohjaimen pysyvien ja tallennettujen vikakoodien vain luku
  -pyynnöt `0A` ja `13B0` sekä counted-DTC-parseri. P0A80 ja P3000 saavat
  varovaiset kuvaukset, jotka ohjaavat tarkistamaan INF-lisäkoodit.
- CT-tilassa vikakoodien poisto on estetty sekä käyttöliittymässä että
  toimintopolussa. Profiilissa ei ole Mode 04-, Active Test-, `2E`-, `2F`-,
  `31`-, koodaus-, turva-avain- tai pakkolatauskomentoja.
- CT:n 7E2-transaktio palauttaa aina 7E0-otsakkeen. DTC-luku käyttää rajattua
  7EA-vastaanottosuodatinta ja poistaa sen transaktion lopussa.
- Lisätty CT-replay-fixture ja 12 uutta testiä. Koko sarja sisältää 113 testiä
  profiileille, ISO-TP:lle, DTC:ille, kuljetuksille, pollaukselle,
  Quicklynksille, tiedostovalitsimelle ja Android-lähteelle.
- Sovellus säilyttää pakettitunnuksen `fi.oliver.is220dobd`, aiemman
  allekirjoitusavaimen, `minSdk 21` / `targetSdk 34` -tasot,
  internetoikeuden puuttumisen ja `usesCleartextTraffic=false`-asetuksen.
- Versionumero nostettu arvoihin `versionName 0.7.0` ja `versionCode 700`.

## 0.6.8 · Adaptive Live

- Lisätty lähdekohtainen live-pollausjono ELM327- ja vLinker-yhteyksille.
  Saman Mode 01 PIDin tai Toyota Read Data -vastauksen kaikki mittarit
  ryhmitellään yhteen lähteeseen, joten esimerkiksi PID `69` ja `217E`
  lähetetään vain kerran eräpäivää kohden.
- Lisätty neljä pollausluokkaa. Kierrosluku ja nopeus luetaan nopeimmin,
  dynaamiset paine-/kuormitusarvot seuraavaksi, lämpötilat harvemmin ja
  MIL-/matka-/käyntiaikatiedot hitaimmin.
- Ajastus valitsee vanhimman erääntyneen lähteen ennen uudelleen erääntynyttä
  nopeaa lähdettä. Näin prioriteetit eivät nälkiinnytä hitaita mittareita.
- Lisätty vasteajan EWMA ja kolmen onnistumisen jälkeen aktivoituva
  adaptiivinen aikakatkaisu. Virheen jälkeen lähde käyttää jälleen
  konservatiivista 2,2 s:n Mode 01- tai 5 s:n Toyota-aikakatkaisua.
- Lisätty vastausluokkakohtainen backoff `response pending`-, uusittaville,
  ei-uusittaville ja yhteyskatkovirheille. Kuljetuskerros ei lähetä komentoa
  automaattisesti uudelleen.
- Lisätty Toyota-profiilin järkevyysalueiden ajonaikainen tarkistus. Vastaus
  voidaan hyväksyä protokollatasolla mutta hylätä live-arvona, jos purettu
  arvo on profiilin alueen ulkopuolella.
- Live-sivulle lisätty pyyntölähteiden, onnistumisten, mittauskadon ja EWMA-
  vasteen yhteenveto. Koeajotallennuksen skeema nostettiin arvoon 4 ja CSV-
  vientiin lisättiin `poll_*`-laatusarakkeet.
- Quicklynks FFF0/FFF6:n pääkehys- ja tuotantoryhmäajoitusta ei muutettu.
  Sovellukseen ei lisätty uusia ajoneuvopyyntöjä, `3E00`-sokkoskannausta,
  Mode 04-, Active Test-, kirjoitus- tai pakotetun regeneroinnin polkuja.
- Versionumero nostettu arvoihin `versionName 0.6.8` ja `versionCode 608`.

## 0.6.7 · Profile & Replay

- Lisätty validoitu, deklaratiivinen
  `is220d-xe20-2ad-fhv-readonly-v1`-ajoneuvoprofiili. Se kokoaa
  2AD-FHV-moottori-ECU:n osoitteet, varmennetut `217E`, `217F` ja `212C`-
  pyynnöt, raakakuoret, vastausalkut, vähimmäispituudet, dekooderit,
  kentät, yksiköt, järkevyysrajat, pollausvälit ja evidenssitason.
- Profiili validoidaan ajonaikaisesti. Väärät CAN-otsakkeet, palvelut,
  komentokuoret, vastaukset, duplikaatit ja kaikki `writable=true`-
  määritykset hylätään ennen kuljetuskerrosta.
- Lisätty atominen read-only ECU-transaktio. Profiilin ELM-asetukset,
  vastaanottosuodatin, `ATSH`-otsake ja yksi tai useampi sallittu lukupyyntö
  pysyvät samassa komentojonon operaatiossa. Toyota-livepolku käyttää tätä
  sekä tunnistuksessa että varsinaisessa pollauksessa.
- Lisätty palveluriippumaton `7F <service> <NRC>` -parseri ja vastausluokitus.
  Raportti erottaa muun muassa tuen puuttumisen, väärät ehdot,
  turvallisuuseston, varatun ECU:n, `response pending` -tilan, `NO DATA`-,
  CAN-, aikakatkaisu- ja yhteyskatkotulokset.
- ISO-TP-purkaja seuraa nyt yksikehyksen tai ensimmäisen monikehyksen
  ilmoittamaa kokonaispituutta ja jatkokehysten järjestystä. Vajaata
  positiivista Toyota-vastausta ei enää hyväksytä mittausarvoksi.
- Laajan raportin muoto nostettu arvoon `elm-can-readonly-v5`. Raporttiin ja
  TSV-osioon lisättiin profiiliversio, evidenssitaso, dekooderi,
  vastausluokka, NRC-palvelu, NRC-koodi, NRC-luokka ja uudelleenyritystieto.
- Lisätty deterministinen ELM-replay-kuljetus sekä Flexin omat fixtuurit
  positiiviselle Toyota-polulle, NRC:lle, `NO DATA`-, `CAN ERROR`-,
  katkennut monikehys- ja hitaalle aikakatkaisutilanteelle.
- Lisätty Flexin itse kirjoittama, vain luku -yhteensopivuusskenaario
  erikseen asennettavalle ELM327-emulaattorille. Emulaattorin tai GPL-3.0-/
  CC BY-NC-SA -projektien lähdekoodia ei ole kopioitu eikä niputettu Flexiin.
- vLinker Classic/BLE-, Quicklynks FFF0/FFF6-, GEKO/ELM-, btsnoop-, CSV- ja
  tiedostonvalitsinpolut säilyvät. Active Test-, Mode 04-, ECU-kirjoitus-,
  avain-/ajonesto- ja pakotetun regeneroinnin komentoja ei lisätty.
- Versionumero nostettu arvoihin `versionName 0.6.7` ja `versionCode 607`.

## 0.6.6 · vLinker Ready

- Lisätty vLinker MC+:n nimitunnistus ja erilliset Android-profiilit
  Bluetooth Classic / SPP- sekä Bluetooth LE -kanaville. Classic
  priorisoidaan, mutta aiemmat Quicklynks- ja yleiset ELM-polut säilyvät.
- Lisätty turvallinen capability-profiili komennoille `ATI`, `STI`, `STDI`,
  `AT@1`, `AT@2`, `ATRV`, `ATIGN`, `ATDP`, `ATDPN` ja `ATCS` sekä näiden
  identiteetti-, ST-ydin-, jännite- ja protokollatietojen raportointi.
- Lisätty vLinkerille positiivisella ECU-vastauksella aktivoituva Toyota-live-
  kerros. Varmennetut `217E`, `217F` ja `212C` tuovat live-näkymään
  DPNR-paine-eron, regenerointitilat ja polton aktiivisuuden, kaksi DPNR-
  lämpöä sekä EGR-asennon. Yhden vastauksen mittarit jaetaan välimuistista
  ilman saman komennon moninkertaista lähetystä.
- Laajennettu BLE UART -tunnistus yhdistettyyn FFF0/FFF1-ominaisuuteen.
  Dynaaminen saman GATT-palvelun kirjoitus- ja ilmoitusominaisuuksien haku
  säilyy julkaisemattomia laitekohtaisia UUID-profiileja varten.
- Lisätty GATT-yhteyden korkean prioriteetin ja 517 tavun MTU-pyyntö sekä
  toteutuneen hyötykuorman, kirjoitustavan, CCCD-arvon ja kuljetusprofiilin
  raportointi.
- Lisätty Classic- ja BLE-kanaville kolmen yrityksen hallittu
  uudelleenyhdistäminen. Kesken jäänyttä komentoa, live-lukua tai tallennusta
  ei lähetetä tai käynnistetä uudelleen ilman käyttäjää.
- vLinker Classic- ja BLE-ohjeet lisätty laitevalintaan. Laaja ELM/CAN-testi
  nimettiin adapteririippumattomaksi vLinker / ELM + Toyota -testiksi.
- Bluetooth-osoite peitetään jaettavan laajan raportin oletusviennissä.
  Raporttimuoto nostettiin arvoon `elm-can-readonly-v4`.
- Toyota-sallintalista (`217E`, `217F`, `212C` ja niiden kolme varmennettua
  raakamuotoa), Quicklynks FFF0/FFF6 -binääripolku, pakettitunnus,
  internetoikeuden puuttuminen ja allekirjoitusidentiteetti säilyvät.
- Versionumero nostettu arvoihin `versionName 0.6.6` ja `versionCode 606`.

## 0.6.5

- Laajennettu GEKO/ASCII-ELM327-diagnostiikka Techstreamin 2AD-FHV-
  määrityksistä varmennettuihin Toyota Read Data -kyselyihin `21 7E`, `21 7F`
  ja `21 2C`.
- Toyota-vaihe käynnistyy, kun ELM vastaa `ATI`:in ja hyväksyy `ATSP6`- sekä
  `ATSH7E0`-asetukset. Onnistunutta `01 00` -vastausta tai kahta perustietoa ei
  enää vaadita, joten testi mittaa Gekon Mode 21 -kykyä itsenäisesti.
- Jokainen puuttuva positiivinen vastaus kokeillaan normaalilla
  ELM-automaattimuotoilulla, `7E8`-vastaanottosuodattimella ja lopuksi raakana
  kahdeksan tavun ISO-TP-yksikehyksenä.
- Toyota-lähetyspolulla on kova sallintalista: `217E`, `217F`, `212C` sekä
  täsmälleen niiden kolme raakaa yksikehysvastinetta. Active Test-, Mode 04-,
  kirjoitus-, poisto- ja regenerointikomentoja ei lisätty.
- Lisätty positiivisten `61 7E`, `61 7F` ja `61 2C` -vastausten sekä
  kielteisten `7F 21 xx` -vastausten tunnistus. Raportti säilyttää jokaisen
  yrityksen raakavastauksen ja kyselyprofiilin.
- Lisätty Techstream-kaavoihin perustuva DPNR-paine-eron, regenerointitilojen,
  kahden pakolämmön ja EGR-asennon purku. Raporttimuoto nostettu arvoon
  `elm-can-readonly-v3`.
- Raakaterminaali sallii nyt samat kolme varmennettua Toyota-lukukomentoa;
  muut `21xx`-komennot pysyvät estettyinä.
- Quicklynks FFF0/FFF6 -polku, BLE-jälkianalyysi, koeajotallennus,
  pakettitunnus, internetoikeuden puuttuminen ja allekirjoitusidentiteetti
  säilytetty.
- Versionumero nostettu arvoihin `versionName 0.6.5` ja `versionCode 605`.

## 0.6.4

- Lisätty Android-bugiraportin pää-TXT:hen upotetun
  `BTSNOOP_LOG_SUMMARY`/btsnooz-aineiston paikallinen purku silloin, kun
  ZIPissä ei ole erillistä `btsnoop_hci.log`-tiedostoa.
- Toteutettu AOSP:n btsnooz v1- ja v2-rakenteet: base64, zlib/deflate,
  little-endian-tietueotsakkeet, HCI-pakettityyppi, suunta ja btsnoop-aikaleima.
- Erillinen `btsnoop_hci.log` säilyy ensisijaisena. ZIP-merkintä voi edelleen
  olla tallennettu tai deflate-pakattu.
- Virheilmoitukset erottavat puuttuvan lokin, vajaan markeriosion,
  virheellisen base64-aineiston, tuntemattoman btsnooz-version ja katkenneen
  tietuerakenteen.
- Raporttiin lisätään lähdemuoto `btsnoop`, `zip-btsnoop` tai `zip-btsnooz`.
  Raporttimuoto säilyy `quicklynks-obdplus-btsnoop-readonly-v1`.
- Tiedoston purku on täysin paikallinen ja passiivinen. Bluetooth-,
  Quicklynks-, GEKO-, ELM327- ja ECU-komentopolkuja ei muutettu eikä Toyota
  `21xx`-, Active Test-, Mode 04-, kirjoitus- tai regenerointikomentoja lisätty.
- Pakettitunnus, järjestelmätiedostonvalitsin, internetoikeuden puuttuminen ja
  aiempi allekirjoitusidentiteetti säilytetty.
- Versionumero nostettu arvoihin `versionName 0.6.4` ja `versionCode 604`.

## 0.6.3

- Korjattu Yhteys-sivun bugiraportin tiedostopainike. WebView käyttää nyt omaa
  `WebChromeClient.onShowFileChooser`-käsittelijää eikä oletusasiakasta, joka
  jätti HTML:n `type=file`-pyynnön käsittelemättä.
- Androidin järjestelmätiedostonvalitsin avataan `ACTION_OPEN_DOCUMENT`- ja
  `CATEGORY_OPENABLE`-rajauksilla. HTML-kentän ZIP-, LOG- ja btsnoop-suodattimet
  välittyvät `FileChooserParams.createIntent()`-kutsusta.
- Valittu tiedosto palautetaan WebViewille
  `FileChooserParams.parseResult()`-käsittelyllä. Keskeytetty valinta ja
  aktiviteetin sulkeminen vapauttavat odottavan `ValueCallback`-kutsun.
- OBD Plus / Quicklynks -jälkianalyysi, raporttimuoto ja nykyinen bugiraportti-
  ZIP-yhteensopivuus säilyvät ennallaan. Uutta OBD Plus -ajoa ei tarvita.
- Korjaus ei lisää tallennus- tai internetoikeuksia eikä muuta Bluetooth-,
  Quicklynks-, GEKO-, ELM327- tai ECU-komentopolkuja.
- Pakettitunnus ja aiempi allekirjoitusidentiteetti säilytetty.
- Versionumero nostettu arvoihin `versionName 0.6.3` ja `versionCode 603`.

## 0.6.2

- Lisätty paikallinen ja passiivinen OBD Plus / Quicklynks Bluetooth HCI
  snoop -jälkianalyysi. Toiminto ei muodosta adapteri- tai ECU-yhteyttä eikä
  lähetä komentoja.
- Tuki Android-bugiraportin ZIPille sekä suoraan puretulle
  `btsnoop_hci.log`-tiedostolle. ZIP-merkintä voi olla tallennettu tai
  deflate-pakattu.
- Lisätty btsnoop/HCI ACL/L2CAP/ATT-parseri Write Request-, Write Command-,
  Notification- ja Indication-tapahtumille.
- Quicklynksin HCI-yhteyden ja kohdekahvan yhdistelmä tunnistetaan vain jo varmennetusta pituus + `41/61`
  -taulukkopyynnöstä. Muiden Bluetooth-kahvojen payloadit jätetään raportista
  pois.
- Raportti ryhmittelee TX/RX-jaksot, luokittelee tunnetut `41/61`-taulukot,
  nostaa tuntemattomat kuoret tutkimuskandidaateiksi ja merkitsee
  `21 7E`/`21 7F`- sekä `61 7E`/`61 7F` -osumat.
- Uusi raporttimuoto `quicklynks-obdplus-btsnoop-readonly-v1`, oma
  aikaleimattu tiedostonimi, jakamisotsikko, analyysipyyntö ja TSV-osio.
- Tuntemattomia kuoria tai Toyota `21xx` -komentoja ei lisätty auton
  lähetyspolkuun. Quicklynksin nykyinen autotutkimus pysyy vain lukituissa
  `02 41 PID` -kyselyissä.
- Classic/BLE-ELM327, Quicklynks-live, laaja 0.6.1-diagnostiikka, koeajo/CSV,
  vikakoodit, simulaattori, pakettitunnus, internetoikeuden puuttuminen ja
  allekirjoitusidentiteetti säilytetty.
- Versionumero nostettu arvoihin `versionName 0.6.2` ja `versionCode 602`.

## 0.6.1

- Lisätty laajan Quicklynks-diagnostiikan alkuun kuusi lukittua
  PID-tukibittikandidaattia `00`, `20`, `40`, `60`, `80` ja `A0`.
- Tutkimusajo sisältää nyt 6 tukibittikyselyä ja 15 PIDiä kolmella kierroksella,
  yhteensä 51 täsmälleen muotoa `02 41 PID` olevaa vain luku -kyselyä.
- Tukibittikandidaatti hyväksytään rakenteellisesti vain täsmälleen neljän
  payload-tavun vastauksesta. Raportti ei väitä karttaa varmaksi ECU:n
  ilmoitukseksi, koska Quicklynks voi muodostaa `41`-payload-kuoren itse.
- Lisätty palatietoinen Quicklynks-koostin: seuraavan BLE-ilmoituksen alun `FF`
  poistetaan vain, kun edellinen pituustavuun perustuva looginen kehys on vielä
  kesken. Varsinaisen hyötydatan sisäisiä `FF`-tavuja ei poisteta.
- Natiivisillan alkuperäiset notification-palot säilyvät muuttamattomina
  raportissa, vaikka parserille annetaan normalisoitu vastaus.
- Ylipitkät, vääränpituiset ja nollatäytteiset Quicklynks-vastaukset erotetaan
  firmware-artefakteiksi tai ei-tuetuiksi. Niitä ei hyväksytä DPF/EGR-arvoiksi.
- TXT-raporttimuoto nostettu arvoon `quicklynks-ble-readonly-v2`. Raporttiin
  lisättiin tukibittiosio, normalisoitu RX, poistettujen jatkomerkkien määrä,
  tukitila, artefaktiluokitus ja laajennettu TSV.
- Koeajotallennuksen automaattinen 55 PIDin tutkimusjono säilyy ennallaan eikä
  lähetä aiemmin virheellisesti käyttäytynyttä `60`-kyselyä. Vain käyttäjän
  käynnistämä laaja tutkimusdiagnostiikka kokeilee sen kerran.
- Toyota `21xx`, aiempi toimimaton `02 61 PID`, ELM-ASCII, Active Test,
  Mode 04, ECU-kirjoitukset ja pakotettu regenerointi pysyvät Quicklynks-polussa
  estettyinä. Techstreamin `21 7E`/`21 7F` -tunnisteita ei lähetetä ilman
  dokumentoitua Quicklynks raw-CAN -kuorta.
- Classic/BLE-ELM327, Quicklynks-live, koeajo/CSV, vikakoodit, simulaattori,
  pakettitunnus `fi.oliver.is220dobd`, internetoikeuden puuttuminen ja aiempi
  allekirjoitusidentiteetti säilytetty.
- Versionumero nostettu arvoihin `versionName 0.6.1` ja `versionCode 601`.

## 0.6.0

- Lisätty Quicklynks FFF0/FFF6 -binäärikanavalle oma laaja
  DPF/EGR-tutkimusdiagnostiikka.
- Diagnostiikka ajaa 15 ennalta sallittua kontrolli-, EGR-, pakokaasu-, DPF-
  ja PM-kandidaattia kolmella kierroksella, yhteensä 45 yksittäistä
  `02 41 PID` -lukukyselyä.
- Quicklynks-vastaukset hyväksytään varmennetulla payload-only-rakenteella;
  PIDiä ei odoteta vastauksesta. Komennon kaiku, tyhjä `00`, jatkuva
  `13 41 …` ja PID-kohtaisesti väärä pituus hylätään.
- Androidin BLE-silta tallentaa jokaisen vastaanotetun notifikaatiopalan
  erikseen sekä raportoi palojen määrän. Laaja raportti erottaa pirstoutuneet
  vastaukset ja useita kehyksiä sisältävät vastaanotot.
- Raportissa ovat täydet TX/RX-raakakehykset, vasteajat, kehys- ja
  notifikaatiomäärät, puskuriin jääneet tavut, kolmen kierroksen
  toistettavuus, automaattiset havainnot ja TSV-osio.
- Quicklynks-diagnostiikka ei lähetä ELM-ASCII-, Toyota `21xx`-, Active Test-,
  Mode 04-, kirjoitus- tai pakotetun regeneroinnin komentoja.
- Laaja ELM/CAN- ja Quicklynks-raportti saavat yksilöllisen raporttitunnuksen,
  adapterikohtaisen tiedostonimen ja oman jakamisotsikon. Koeajoanalyysi säilyy
  erillisenä jakotyyppinä.
- Jokainen diagnostiikan tallennus tai jako käyttää uutta aikaleimattua ja
  satunnaistettua tiedostonimeä; vanhaa jakotiedostoa ei käytetä uudelleen.
- Moottorin tila kirjataan ensisijaisesti havaitusta RPM:stä. Automaattivalinta
  ei enää muutu puuttuvan valintaruudun vuoksi arvoksi **ei**.
- TXT-diagnostiikka viedään ja jaetaan MIME-tyypillä `text/plain`; CSV-koeajot
  säilyvät tyypissä `text/csv`.
- Pakettitunnus `fi.oliver.is220dobd`, internetoikeuden puuttuminen ja aiempi
  allekirjoitusidentiteetti säilytetty.
- Versionumero nostettu arvoihin `versionName 0.6.0` ja `versionCode 600`.

## 0.5.1

- Tavallinen ELM327-yhdistäminen odottaa 1,8 sekuntia Bluetooth-yhteyden
  jälkeen ja kokeilee `0100`:aa nykyisillä asetuksilla ennen `ATZ`-nollausta.
- Toimivaa nykytilaa ei enää nollata tai korvata turhaan. Ensimmäinen
  kelvollinen `41 00` -vastaus lukitsee toimivan yhteyspolun live-dataa varten.
- `ATZ`-nollauksen jälkeen käytetään pakotettua 1,8 sekunnin asettumisviivettä,
  `ATAT2`-ajoitusta ja pisintä `ATSTFF`-vastausodotusta.
- Automaattinen `ATSP0`-haku tehdään ilman ennakkoon asetettua `ATSH`-otsaketta
  tai `ATCRA`-vastaanottosuodatinta ja siinä on neljä yritystä sekä todelliset
  yritysvälit myös välittömän `NO DATA` -vastauksen jälkeen.
- Lisätty erilliset väliaikainen `ATTP6`- ja pakotettu `ATSP6`-CAN 11/500
  -yhteyspolut. Seuraavia polkuja ei ajeta, jos edellinen palauttaa `41 00`.
- Laaja diagnostiikka kokeilee nykytilaa ennen nollausta ja kirjaa raporttiin
  ensimmäisen toimivan yhteyspolun sekä ohitetut vaihtoehdot.
- Passiivinen `ATMA`-CAN-kuuntelu pidennetty 0,9 sekunnista 20 sekuntiin.
- Raporttimuoto nostettu arvoon `elm-can-readonly-v2`; TSV sisältää nyt myös
  `connection_strategy`-sarakkeen.
- Quicklynks FFF0/FFF6 -binääripolku, Classic- ja BLE-kuljetukset,
  `fi.oliver.is220dobd`, internetoikeuden puuttuminen ja aiempi
  allekirjoitusidentiteetti säilytetty.
- Versionumero nostettu arvoihin `versionName 0.5.1` ja `versionCode 501`.

## 0.5.0

- Korvattu pysähtyvä GEKO-täsmätesti automaattisella laajalla
  ELM327/CAN-diagnostiikkajärjestelmällä.
- Testi jatkaa `NO DATA`-, `?`-, `UNABLE TO CONNECT`- ja aikakatkaisuvastausten
  jälkeen ja säilyttää jokaisen vaiheen tuloksen.
- Lisätty adapterin `ATI`, `AT@1`, `AT@2`, `ATRV`, `ATIGN`, `ATDP`, `ATDPN`
  ja `ATCS` -kartoitus.
- Lisätty kolme pitkää `ATSP0`-yritystä ja erillinen pakotettu `ATSP6`-
  CAN 11/500 -testi useilla odotusajoilla.
- Lisätty yleisosoitteen `7DF` ja suorien pyyntöosoitteiden `7E0`–`7E7`
  automaattinen haku. `7E0` testataan myös `010C`, `0105` ja `0110`
  -perustiedoilla, vaikka `0100` ei vastaisi.
- Lisätty `ATCRA7E8`-vastaanottosuodatin, `ATCAF0`/`ATCFC0`-raakamuoto,
  lyhyet ja täydet kahdeksan tavun `01 00` -CAN-kehykset sekä lyhyt
  passiivinen `ATMA`-kuuntelu.
- Lisätty laaja vain lukeva Mode 01/03/07/09/0A -kartoitus: PID-alueet,
  keskeiset moottoriarvot, vikakoodit, VIN, kalibrointitunnisteet ja ECU-nimi.
- Toyota `217E` säilyy täsmälleen sallittuna lukukomentona ja lähetetään vain,
  jos suora `7E0/0100` sekä vähintään kaksi kolmesta perustiedosta vastaavat.
- Lisätty vaihekohtainen edistyminen, keskeytyspyyntö, hallittu ELM-asetusten
  palautus ja automaattinen parhaan löytyneen pyyntöosoitteen valinta.
- Lisätty TXT-raportti, jossa ovat ympäristötiedot, oire, yhteenveto,
  automaattiset havainnot, kaikki raakavastaukset ja koneluettava TSV.
- Raportin voi kopioida, tallentaa tai jakaa suoraan ChatGPT:lle Androidin
  jakovalikolla ilman taustalatausta tai internetoikeutta.
- `ATCS`-arvo kirjataan havaintona ilman varmaa kloonikohtaista
  virhelaskuritulkintaa.
- Quicklynks FFF0/FFF6 -binääripolku, BLE-ELM327, Classic/SPP, koeajot,
  CSV-vienti, `fi.oliver.is220dobd` ja aiempi allekirjoitus säilytetty.
- Versionumero nostettu arvoihin `versionName 0.5.0` ja `versionCode 500`.

## 0.4.3

- Bluetooth Classic / ELM327 -yhteys erotettu kolmeen näkyvään vaiheeseen:
  Bluetooth, ELM327 ja moottori-ECU.
- Yhteyttä ei enää merkitä vihreäksi pelkän RFCOMM- ja ELM-alustuksen jälkeen.
  Moottori-ECU varmennetaan kelvollisella `41 00` -vastauksella kyselyyn
  `0100`.
- Automaattisen protokollan epäonnistuessa kokeillaan kerran
  ISO 15765-4 CAN 11 bit / 500 kbit/s -protokollaa (`ATSP6`).
- ELM voi jäädä yhdistetyksi ECU-virheen jälkeen, jotta käyttäjä voi kopioida
  täydellisen TX/RX-raakalokin vianmääritystä varten.
- Classic-laitetta käytettäessä vanha BLE/GATT-diagnostiikka piilotetaan.
- Lisätty rajattu GEKO/ELM327-testi komennoille `0100`, `010C`, `0105` ja
  `0110`.
- Toyota `ATSH7E0` + `217E` lähetetään vain, jos `0100` ja vähintään kaksi
  kolmesta perustiedosta toimivat. Testin jälkeen palautetaan `ATSH7DF`,
  `ATH0`, `ATS0` ja varmennetaan `0100` uudelleen.
- CAN-otsakkeellisten 11-bittisten `7E8`-vastausten parseri korjattu.
- Quicklynks FFF0/FFF6 -polku, payload-only-parseri, 55 standardiprobea,
  pakettitunnus ja internetoikeuden puuttuminen säilytetty.
- Versionumero nostettu arvoihin `versionName 0.4.3` ja `versionCode 403`.

## 0.4.2

- Korjattu Quicklynksin yksittäisvastausten rakenne 51 minuutin IS220d-koeajon
  perusteella. Pyyntö `02 41 PID` palauttaa muodon
  `[pituus] [41] [arvotavut]`; PID ei toistu vastauksessa.
- Valinnaiset standardoidut diesel-PIDit puretaan nyt payload-only-muodossa.
  Tulkinta vaatii PID-kohtaisen hyötydatan pituuden ja äärellisen tuloksen.
- Komennon kaiku, adapterin tyhjä `02 41 00` -palaute ja jatkuva
  `13 41 …` -koontikehys hylätään yksittäiskyselyn vastauksena.
- Poistettu Quicklynksiltä kaikki 13 toimimatonta `02 61 PID` -Toyota Read
  Data 21 -kyselyä. Autotestissä jokainen palautti vain `02 61 00`, ei ECU:n
  valmistajavastausta.
- PID-tutkimus päivitetty skeemaan 6 ja 55 sallittuun `02 41 PID`
  -lukukyselyyn. Tutkimus-CSV kertoo payload-only-rakenteen eikä odota PID:iä
  vastausdatasta.
- Säilytetty Quicklynksin pääkehys, fast/slow-ryhmät, Classic/BLE-ELM327,
  pakettitunnus, allekirjoitus ja internetoikeuden puuttuminen.
- Versionumero nostettu arvoihin `versionName 0.4.2` ja `versionCode 402`.

## 0.4.1

- Lisätty Techstream 12.20.024:n EU-tietokannasta juuri Lexus IS220d:n
  `2AD-FHV` / `ECD_P3` -moottorinohjaukseen sidotut Toyota Read Data 21
  -tunnisteet. Quicklynks-kuori käyttää kyselytyyppiä `0x61` ja hyväksyy vain
  täsmällisen `61 PID` -vastauksen.
- Lisätty tuotantomittareiksi DPNR-paine-ero, DPNR:n S/PM-regenerointitilat,
  pakolämpö ennen ja jälkeen DPNR:n, polttoainelämpö, common rail -paine,
  suutinkorjaukset 1–4 ja ruiskutusajoitus. Mittari ilmestyy vasta oikean
  vastaustyypin, PID:n ja vähimmäispituuden tarkistuksen jälkeen.
- DPNR/DPF-polttoilmaisin käyttää ensisijaisesti valmistajakohtaisen `21 7E`
  -vastauksen tilakoodia `2 = Operate`; standardi PID `8B` säilyy varatietona.
  Ilmaisin näyttää käytetyn lähteen.
- PIDit `91`, `92`, `97`, `9A`, `9F`, `AD` ja `AE` tallennetaan vain
  raakavastauksina. Niille ei ole lisätty ECU-versiokohtaisesti epävarmaa
  nimeä, yksikköä tai muunnoskaavaa.
- Tutkimussuunnitelma sisältää nyt 68 sallittua pyyntöä ja skeeman 5.
  Ensimmäiset 13 ovat Toyota Read Data 21 -kyselyitä; loput 55 ovat aiemmat
  rajatut standarditutkimukset.
- Standardi- ja Toyota-lisäkyselyt vuorottelevat, jotta Quicklynksin
  liikennekuorma ei kaksinkertaistu. DPNR `7E` priorisoidaan valmistajaryhmän
  sisällä.
- Active Test-, vikakoodien poisto-, Mode 22- tai muita kirjoituskomentoja ei
  lisätty. Internet-oikeus, pakettitunnus, Classic/BLE-ELM327-polut ja aiemmat
  Quicklynks-toiminnot säilyivät.
- Versionumero nostettu arvoihin `versionName 0.4.1` ja `versionCode 401`.

## 0.4.0

- Lisätty standardoidut Mode 01 -muunnokset lambda-, EGR-, rail-paine-,
  polttoainelämpö-, ahtopaine-, VGT-, pakopaine-, EGT-, DPF- ja
  PM-anturiryhmille. Lähteenä käytettiin AndrOBD-APK:n mukana olevia
  standardi-OBD-määrittelyjä; Toyota-kohtaisia Mode 22 -tunnisteita ei arvattu.
- Quicklynks kokeilee 17 ennalta sallittua standardoitua diesel-PID:iä yksi
  kerrallaan. Mittari otetaan käyttöön vasta täsmällisen `41 XX`-vastauksen ja
  riittävän hyötydatan jälkeen; epäonnistunut tunniste odottaa 120 sekuntia.
- Tunniste `86` on jätetty Quicklynksin lisäkyselyistä pois, koska se on jo
  varmennettu Quicklynks-pääkehyksen käyntiaikatunnisteeksi. Tavallisella
  ELM327:llä standardi-PID `86` säilyy mahdollisena.
- Lisätty Koeajo-näkymään kolmitilainen DPF-polttoilmaisin: ei tuettua
  standardivastausta, ei käynnissä tai käynnissä.
- Standardi-ELM327:n tukibittien luku ulottuu tarvittaessa PID-alueeseen
  `81–A0`. Samaa monikenttäistä PID:iä käytetään 250 ms välimuistista, jotta
  yhtä ECU-vastausta ei pyydetä jokaiselle kentälle erikseen.
- Valinnaisen Quicklynks-PID:n puuttuminen kirjataan diagnostiikkaan mutta ei
  koeajonäytteen virheeksi.
- Quicklynksin tutkimusjonoa laajennettiin 55 yksittäiseen vain luku
  -pyyntöön. Tutkimusskeema on 4 ja suunnitelma
  `quicklynks-read41-diesel-standard-v4-no-60`.
- Korjaamo-opas vahvistaa valmistajakohtaisten Data List -arvojen nimet ja
  vertailualueita mutta ei niiden kyselytunnisteita. Suutinkorjauksia,
  ruiskutusmäärää, DPNR-noki-/tuhkamassaa, IMV/SCV-arvoja tai 5. suuttimen
  tilaa ei siksi lisätty arvaamalla.
- Bluetooth Classic / SPP, tavallinen BLE-ELM327, Quicklynks FFF0/FFF6,
  vikakoodit, CSV-vienti, pakettitunnus ja allekirjoitusidentiteetti säilyivät.
- Versionumero nostettu arvoihin `versionName 0.4.0` ja `versionCode 400`.

## 0.3.7

- Lisätty Quicklynksin vain luku -tutkimusjonon alkuun yksittäiset Mode 01
  -ehdokkaat `78`, `79`, `7A`, `7B` ja `7C`.
- Uudet pyynnöt tallennetaan ryhmällä `aftertreatment_standard_candidate`.
  Ne on tarkoitettu pakokaasulämpötila- ja hiukkassuodatintietojen
  raakakokeeseen; sovellus ei nimeä vastauksia EGT-, paine- tai DPNR-arvoiksi
  ilman autossa tehtyä tavurakenteen ja muunnoksen varmennusta.
- Tutkimuspyynnöt ovat edelleen täsmälleen muotoa `02 41 XX`, käytössä vain
  Quicklynks-koeajotallennuksen aikana ja erotettu normaalista
  mittarikehyksestä.
- Tutkimussuunnitelmassa on 47 sallittua pyyntöä. Tunnisteet `78–7C`
  suoritetaan ensin, jotta ne ehtivät mukaan myös lyhyeen lämpimään
  oireotokseen.
- Tutkimusviennin skeema nostettu versioon 3 ja suunnitelmatunnisteeksi
  `quicklynks-read41-aftertreatment-v3-no-60`.
- `DPNR Status Reju (PM/S)`, Exhaust Fuel Addition, A/C-signaali ja
  jäähdytyspuhaltimen tila eivät ole näitä standardiehdokkaita ja vaativat
  edelleen Toyota/Techstream-kyselyjen tunnistamisen.
- Virheellisesti käyttäytynyt `60`-tukibittikysely pysyy estettynä.
- Versionumero nostettu arvoihin `versionName 0.3.7` ja `versionCode 307`.

## 0.3.6

- Lisätty kolmen 29.7.2026 koeajon perusteella varmennetut Quicklynksin
  standardi-PID-arvot jatkuvaan tuotantolukutukseen.
- Fast-ryhmä lukee noin kahden sekunnin välein MAP:n `0B`, MAF:n `10`,
  rail-paineen `23`, kaasupolkimen D/E `49`/`4A` ja
  kaasuläppätoimilaitteen pyynnön `4C`.
- Slow-ryhmä lukee noin 15 sekunnin välein MIL-tilan ja vikakoodimäärän `01`,
  imuilman lämpötilan `0F`, käyntiajan `1F`, matkan vikakoodien nollauksesta
  `31`, ilmanpaineen `33` ja ECU-jännitteen `42`.
- Lisäryhmät käyttävät vain ennalta lukittuja `0x41`-lukukyselyitä. Kahden
  peräkkäisen virheen jälkeen vain epäonnistunut ryhmä asetetaan 60 sekunnin
  tauolle; pääkehyksen lukeminen jatkuu.
- Quicklynksin pääkehyksen jännite nimettiin `adapterVoltage`-arvoksi ja
  standardi-PID `42` säilytettiin erillisenä `voltage`-ECU-jännitteenä.
- Aiempi `adapterMaf`-tulkinta poistettiin. Kenttä 80 viedään neutraalina
  `quicklynksField80`-arvona ilman yksikköä tai moottoriteknistä tulkintaa.
- Pääkehyksen kentät `84` ja `86` nimettiin kenttätestin perusteella
  Quicklynks-ajomatkaksi ja moottorin käyntiajaksi.
- Lisätty johdettu `boostPressure = MAP − ilmanpaine`. Arvo erotetaan
  ECU:n ahtopainepyynnöstä.
- CSV-skeema 3 sisältää jokaiselle mittarille `*_age_ms`-ikäsarakkeen.
  Tavallinenkin CSV sisältää nyt UTF-8 BOM:n, puolipiste-erottimen ja
  desimaalipilkun.
- Vanhojen Quicklynks-sessioiden `fuelRate`/`adapterMaf` ja `voltage`
  muunnetaan viennissä uusiin neutraaleihin nimiin.
- Virheellisesti käyttäytynyt Quicklynksin `60`-tukibittikysely poistettiin
  tutkimussuunnitelmasta. Tutkimuksessa on nyt 42 sallittua pyyntöä.
- Bluetooth Classic / SPP, tavallinen BLE-ELM327, DTC-toiminnot,
  Quicklynks-pääkehys, PID-tutkimus, pakettitunnus ja allekirjoitus
  säilytettiin.
- Versionumero nostettu arvoihin `versionName 0.3.6` ja `versionCode 306`.

## 0.3.5

- Lisätty Quicklynksin vain luku -PID-tutkimuskerros. Se toimii automaattisesti
  vain Quicklynks-koeajotallennuksen aikana eikä lisää käyttöliittymään uutta
  painiketta.
- Tutkimus hajottaa ensin varmennetun koontikyselyn 12 tunnistetta
  yksittäisiksi pyynnöiksi ja käy sen jälkeen läpi 31 rajattua standardi-PID
  -ehdokasta.
- Jokainen tutkimuspyyntö on täsmälleen pituustavu + `0x41` + yksi
  ennalta sallittu tunniste (`02 41 XX`). Koko `00–FF`-avaruutta ei skannata.
- Yksi tutkimuspyyntö tehdään 10 sekunnin välein 750 ms:n aikakatkaisulla.
  Epäonnistunut tunniste kirjataan mutta se ei keskeytä normaalia lokitusta.
- Raakavientiin tallennetaan pyyntö, vastaus, kehysten lukumäärä,
  vastaustyyppi, tulkitsematon hyötydata, kesto, tulos ja lähimmän
  koeajonäytteen arvot.
- Tavallinen **Tallenna CSV** säilyy skeemana 2. **Jaa tekoälyanalyysiin**
  käyttää tutkimusta sisältävällä Quicklynks-ajolla yhdistettyä
  tutkimus-CSV:tä, jossa `record_type` erottaa `sample`- ja `pid_probe`-rivit.
- Tutkimus-CSV on puolipiste-eroteltu, sisältää UTF-8 BOM:n ja käyttää
  desimaalipilkkua, jotta suomalainen Excel ei muuta esimerkiksi 12,44 V:n
  arvoa päivämääräksi.
- Ehdokasnimet eivät ole tuotantomittareita: sovellus ei lisää raakavastauksille
  muunnoskaavoja tai yksiköitä ennen kenttä- ja Techstream-varmennusta.
- Mode 22-, Active Test-, vikakoodien poisto- ja muut kirjoituskomennot on
  jätetty tutkimuksesta pois.
- Versionumero nostettu arvoihin `versionName 0.3.5` ja `versionCode 305`.

## 0.3.4

- Lisätty tallennetun ajon **Jaa tekoälyanalyysiin** -toiminto. Androidin
  jakovalikko lähettää käyttäjän valitsemaan sovellukseen CSV-tiedoston ja
  valmiin, ajoneuvo- ja saraketiedot sisältävän analyysipyynnön.
- Tekoälypyyntö ohjaa tarkistamaan datan laadun, tapahtumamerkit ja
  signaalien yhteydet sekä erottamaan havainnot, tulkinnat ja epävarmuudet.
  Se kertoo myös, mitä DPNR-, EGR-, pakokaasulämpö- ja suutinarvoja CSV ei
  sisällä.
- Tallennetulle ajolle voi kirjoittaa oireen tai muun havainnon, joka
  tallennetaan sessioon ja liitetään analyysipyyntöön.
- CSV-versio 2 sisältää ajoneuvon, adapterin, protokollan, sovellus- ja
  skeemaversion, session aikavälin, käyttäjän huomion sekä näytekohtaisen
  `sample_gap_ms`-sarakkeen.
- Quicklynksin aiempi `fuelRate`-tulkinta korjattu kenttätestin perusteella
  adapterin ilmamassavirta-arvoksi `adapterMaf` (g/s). Tavallisen ELM327:n
  standardi PID `5E` säilyy erillisenä oikeana polttoainevirtana.
- Flex 0.3.3:lla tallennetut Quicklynks-ajot muunnetaan CSV-viennissä
  automaattisesti `fuelRate`-sarakkeesta `adapterMaf`-sarakkeeksi, joten vanha
  väärä nimi ei siirry tekoälyanalyysiin.
- Jakaminen ei lisää sovellukseen internetoikeutta: tiedosto luovutetaan vasta
  Androidin jakovalikossa käyttäjän valitsemalle sovellukselle.
- Versionumero nostettu arvoihin `versionName 0.3.4` ja `versionCode 304`.

## 0.3.3

- Quicklynksin varmennetusta 19 tavun mittarikehyksestä tulkitaan nyt RPM:n ja
  nopeuden lisäksi jäähdytysneste, ohjainlaitteen jännite, laskennallinen
  moottorin kuormitus ja adapterin polttoainevirta-arvio.
- Uusien kenttien tavupaikat ja kaavat tarkistettiin valmistajan OBD Plus 4.1.6
  -sovelluksen saman kehyksen parserista.
- Kuusi mittariarvoa jaetaan yhdestä BLE-kyselystä; jokaista arvoa varten ei
  lähetetä erillistä komentoa.
- Polttoainevirran kortissa näytetään Quicklynks-yhteydellä lähteenä
  `Quicklynks-adapterin arvio`.
- Huomautus: tämä Quicklynks-tulkinta korjattiin 0.3.4:ssä auton koeajodatan
  perusteella ilmamassavirtaa vastaavaksi adapterikentäksi.
- Tavalliselle ELM327-polulle lisättiin standardi Mode 01 PID `5E`
  polttoainevirralle.
- Uudet arvot ovat mukana live-korteissa, kuvaajissa, koeajonäkymässä,
  tallennuksessa, CSV-viennissä ja sessiotilastoissa.
- Vielä tulkitsemattomat Quicklynks-kentät näytetään tunnuksineen raakadatana.
- Classic/SPP-, tavallinen BLE-ELM327-, skannaus-, DTC- ja turvarajaukset
  säilytettiin.
- Versionumero nostettu arvoihin `versionName 0.3.3` ja `versionCode 303`.

## 0.3.2

- Korjattu OnePlus/OxygenOS-kenttätestissä varmennettua tilannetta, jossa
  nRF Connect näkee Motonetin `OBD`-lukijan mutta Flex saa 0 scan-callbackia.
- BLE-haku suoritetaan Androidin pääsäikeellä enintään kolmessa vaiheessa:
  suodattamaton oletushaku, suodattamaton `LOW_LATENCY`-haku ja
  `OBD`-nimisuodatettu `LOW_LATENCY`-haku.
- Diagnostiikka näyttää jokaisen käynnistyneen hakuvaiheen callback-määrän ja
  viimeiseksi käytetyn hakutavan.
- Jos Motonet-lukija ei näy Androidin hakutuloksissa, Flex lisää valittavaksi
  suoran GATT-varmistuksen testissä varmennetulle osoitteelle
  `25:28:07:06:00:66`.
- Quicklynksin FFF0/FFF6-binääriprotokolla, tavallinen BLE-ELM327 ja
  Bluetooth Classic / SPP säilyvät ennallaan.
- Versionumero nostettu arvoihin `versionName 0.3.2` ja `versionCode 302`.

## 0.3.1

- Korjattiin OnePlus 10T / Android 15 / OxygenOS 15 -kenttätestissä havaittu BLE-haku, joka päättyi nollaan laitteeseen ilman natiivivirhettä.
- BLE-haku käyttää Androidin virallisen esimerkin mukaista suodattamatonta `BluetoothLeScanner.startScan(callback)`-kutsua.
- Hakuaika pidennettiin 15 sekuntiin.
- Mainospaketin nimen puuttuminen ei enää aiheuta erillistä `BluetoothDevice.getName()`-kutsua eikä voi pudottaa muuten kelvollista hakutulosta.
- Diagnostiikka näyttää skannaustavan, keston ja Androidin palauttamien scan-callbackien määrän.
- Quicklynks FFF0/FFF6 -binääriprotokolla, Classic ELM327 -tuki, pakettitunnus ja allekirjoitus säilytettiin.

## 0.3.0

- Sovelluksen käyttäjälle näkyvä nimi on nyt **IS220d OBD Flex**.
- `applicationId` ja Flex 0.2.1:n päivitysallekirjoitus säilytettiin.
- BLE-haku löytää `OBD`-nimisen laitteen ilman Android-paritusta.
- Lisättiin varmennettu Quicklynks `FFF0/FFF6` -binäärikuljetus.
- FFF6:n notification otetaan käyttöön CCCD-arvolla `0100`.
- TX käyttää Write Without Response -toimintoa.
- Lisättiin pituustavuun perustuva vastaanottopuskuri pirstoutuneille ja yhdistetyille kehyksille.
- Lisättiin kyselyjono, aikakatkaisu, vanhan GATT:n varma sulkeminen ja yksi hallittu uudelleenyhdistämisyritys.
- Varmennettu kysely päivittää kierrosluvun ja nopeuden; muut tavut näytetään raakadatana.
- Quicklynks FFF6 -polulla ASCII-ELM327-alustus, vikakoodikomennot ja raakaterminaali estetään.
- Kopioitavaa BLE-diagnostiikkaa laajennettiin UUID-, CCCD-, TX/RX HEX-, kehys-, aikakatkaisu- ja yhteyskatkotiedoilla.
- Bluetooth Classic-, tavallinen ELM327-, koeajo-, CSV-, kuvaaja- ja simulaattoritoiminnot säilytettiin.
- APK:ssa ei ole internetoikeutta ja selväkielinen verkkoliikenne on estetty.
