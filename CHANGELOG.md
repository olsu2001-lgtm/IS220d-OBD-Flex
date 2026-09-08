# Muutoshistoria

## 0.6.9 · DPNR-tarkistus

- Lisätty ajossa ja tyhjäkäynnillä käytettävä DPNR-tarkistusnäkymä Vgate
  vLinker MC+:lle. Näkymä kokoaa paine-eron, DPNR:n tulo- ja lähtölämmöt,
  S/PM-regenerointitilat ja polton aktiivisuuden sekä RPM-, jäähdytysneste-,
  MAF- ja jänniteolosuhteet samaan ruutuun.
- Toyota `217E`- ja `217F`-raakavasteet näytetään tulkittujen arvojen rinnalla.
  Täsmälleen samoina pysyvät lämpötilat ja erityisesti 750 °C:n kaksoislukema
  nostetaan tarkistusvaroitukseksi, ei automaattiseksi anturiviaksi.
- Koeajolokin skeema 5 säilyttää viimeisimmät `217E`, `217F` ja `212C`
  -raakavasteet jokaisella näytteellä ja vie ne CSV:hen.
- Techstreamin `DPF Thermal Deteriorate`, `DPF PM Block` ja `DPF No Activate`
  jätetään vertailulipuiksi. Niille ei lisätty arvattuja Toyota-tunnisteita tai
  tavumuunnoksia.
- Toyota-sallintalista säilyy täsmälleen `217E`, `217F` ja `212C`. Quicklynksin
  FFF0/FFF6-polku, Classic/SPP, BLE-ISO-TP, vikakoodit ja olemassa oleva
  tallennus säilyvät erillisinä.
- Versionumero nostettu arvoihin `versionName 0.6.9` ja `versionCode 609`.

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
