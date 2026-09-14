# Lexus OBD Flex

Current version is defined only in `package.json`. Before any update or APK
delivery, read [the release workflow](docs/VERSIONING.md) and the shared
[`flex-release-registry`](https://github.com/olsu2001-lgtm/IS220d-OBD-Flex/blob/flex-release-registry/releases/registry.json).
The latest registered source commit is the delivered baseline; `main` and old
branch names may lag behind it.

## Feature history

Flex 0.8.1 yhdistää samaan kenttätestiversioon kolmen ajon ECU Surveyn,
Field Test Moden, Techstream-vertailun, Evidence Support Bundle v1:n sekä
IS220d / 2AD-FHV -moottorin DPNR-tarkistusnäkymän. Flex 0.8.1 estää nykyisellä
`35360000`-kalibroinnilla 45 sekunnin suutintestin ennen CAN-lähetystä, koska
sen `219C`-pyyntö palautti `NO DATA` kolmessa toistettavassa kenttäajossa.
Korvaavaa tunnistetta ei arvata: näkymä näyttää `EI TUETTU`, kunnes oikea
Techstream Data List -tapahtuma on varmennettu. Historiallinen TXT-raportointi
ja analyysirajat säilyvät lähteessä tulevaa varmennettua toteutusta varten.

Flex 0.7.5 korjasi 0.7.3:n APK:ssa havaitun WebView-käynnistysvirheen, joka
esti teeman vaihdon, sivunavigaation ja Bluetooth-laitelistan toiminnan.
Rakennus validoi nämä kolme toimintoa jatkossa myös paketoidusta
`app.bundle.js`-tiedostosta ennen APK:n muodostamista. Flex 0.8.1 lukitsee
lisäksi Live-kuvaajan korkeuden, estää kentässä vastaamattoman `219C`-pyynnön
ja vapauttaa käyttöliittymän ennen lyhyeksi rajattua ELM/CAN-palautusta.

Paikallisesti toimiva Android-diagnostiikkasovellus Lexus CT 200h / ZWA10:lle
ja Lexus IS220d / XE20:lle. Flex 0.7.7 säilyttää 0.7.4:n toiminnon, joka tunnistaa yhteydessä olevan auton
automaattisesti standardin VIN-luvun ja varmennettujen Lexus-mallitunnisteiden
perusteella. Flex 0.7.3:n järjestelmäteema, kuusi vaihdettavaa väripalettia
sekä teemoihin mukautuvat kuvaajat säilyvät. Flex 0.7.2:n
GPS-pohjainen kiihtyvyys- ja tehoarvio sekä Flex 0.7.1:n CT 200h
-ostotarkastus säilyvät aiempien validoitujen, vain lukevien profiilien päällä.
Sovellus säilyttää hybridiohjaimen
7E2/7EA-livearvot,
14 HV-akkulohkon jännitteet ja sisäiset vastukset, lämpötilat, akkuvirran,
tehorajat, varaustilat sekä 0A/13B0-hybridivikakoodien luvun. CT-profiili ei
lähetä vikakoodien poistoa, Active Test-, kirjoitus-, koodaus- tai
pakkolatauskomentoja.

Flex 0.6.8:n lähdekohtainen prioriteettipollaus, samasta vastauksesta
johdettujen mittarien fan-out, adaptiivinen aikakatkaisu, virhebackoff sekä
mittauskadon ja vasteajan laadunseuranta säilyvät.
Flex 0.6.7 lisää validoidun 2AD-FHV-diagnostiikkaprofiilin,
atomiset ECU-lukutransaktiot, yleisen kielteisten ECU-vastausten luokittelun,
katkenneiden ISO-TP-vastausten tarkistuksen sekä replay- ja emulaattoritestit.
Flex 0.6.6 lisää vLinker MC+:lle erilliset Bluetooth Classic- ja
BLE-profiilit, automaattisen adapteritunnistuksen, turvallisen capability-
raportin, dynaamisen BLE UART -haun, MTU-neuvottelun ja hallitun
uudelleenyhdistämisen. Classic on Androidissa ensisijainen yhteystapa; BLE
säilyy erillisenä vaihtoehtona. Flex 0.6.5 lisää ASCII-ELM327-/GEKO-polulle Techstreamista
varmennettujen Toyota Read Data -lukujen automaattisen testin ja tulkinnan.
Flex 0.6.4 purkaa OxygenOSin ja muiden Android-versioiden
bugiraportin pää-TXT:hen tallennetun `BTSNOOP_LOG_SUMMARY`- eli btsnooz-aineiston.
Flex 0.6.3:n järjestelmätiedostonvalitsin ja Flex 0.6.2:n paikallinen,
passiivinen Bluetooth HCI snoop -jälkianalyysi säilyvät raw-CAN-komentokuoren
selvittämiseen.
Flex 0.6.1:n DPF/EGR-tutkimusdiagnostiikka, PID-tukibittikandidaatit,
palatietoinen BLE-koostaminen ja firmware-artefaktien tunnistus säilyvät. Aiempi
klooniturvallinen ELM/CAN-diagnostiikka,
hidas otsakkeeton automaattihaku sekä erilliset `ATTP6`- ja `ATSP6`-polut
säilyvät.

Sovellus säilyttää tavallisen ASCII-ELM327-tuen sekä varmennetun Motonet
Quicklynks BLE327 -binäärikuljetuksen. Quicklynks-polku lukee pääkehyksen,
kenttätestillä varmennettuja standardi-PID-arvoja ja turvallisia
standardoituja diesel-lisä-PID:ejä. Tallennetun koeajon voi edelleen jakaa
Excel-turvallisena CSV-tiedostona tekoälysovellukseen.

## Automaattinen ajoneuvotunnistus 0.7.4

**Automaattinen tunnistus (suositus)** on uuden asennuksen oletus. Flex ajaa
tunnistuksen jokaisella ASCII-ELM327- tai vLinker MC+ Classic/BLE -yhteydellä.
Myös tallennetun IS220d- tai CT 200h -käsivalinnan yhteydessä tunnistus
tehdään; käsivalintaa käytetään vain, jos auto ei anna riittävää näyttöä.

Tunnistus yhdistää seuraavat vain lukevat lähteet:

- standardin Mode 09 PID 02 VIN-tunniste;
- CT 200h:n hybridiohjaimen `7E2/7EA`-osoitteesta luettu `21C1`-tunniste,
  jonka pitää sisältää ZWA10;
- IS220d:n moottoriohjaimen kaikki kolme varmennettua `217E`, `217F` ja
  `212C`-lukuvastausta.

Vahva yhden lähteen tunnistus voi valita profiilin, ja yhteensopiva VIN +
mallikohtainen ECU-vastaus merkitään varmaksi tunnistukseksi. Ristiriitaisista
tiedoista ei arvata autoa. Jos tietoa ei saada, Flex kertoo syyn ja käyttää
käsin valittua varaprofiilia tai yleistä EOBD-tilaa. Tunnistuksen voi ajaa
uudelleen Yhteys-sivun **Tunnista auto uudelleen** -painikkeella, kun live-luku
ja testit eivät ole käynnissä.

Quicklynks FFF6 -binääriprotokollalle ei ole varmennettua VIN- tai Toyota-
mallitunnisteen lukua. Sillä appi ilmoittaa rajoituksesta ja käyttää
käsivalintaa; yleinen varmennettu Quicklynks-OBD-luku toimii ennallaan.
Tunnistus ei lisää kirjoitus-, poisto-, Active Test- tai
pakkoregenerointikomentoja.

## Teemat 0.7.3

Teemavalitsin avautuu **Yhteys → Sovelluksen teema** -kortista. Vaihtoehdot:

- **Järjestelmä** seuraa Androidin tummaa ja vaaleaa tilaa.
- **Lexus Dark** on Flexin alkuperäinen tumma vihreä ulkoasu.
- **Pearl Light** on vaalea helmiäissävyinen päiväkäyttöön tarkoitettu teema.
- **OLED Black** käyttää puhdasta mustaa taustaa ja hillittyä vihreää.
- **Hybrid Blue** käyttää CT 200h -henkistä tummansinistä palettia.
- **F Sport Red** käyttää grafiitinharmaata taustaa ja punaista korostusta.
- **Korkea kontrasti** käyttää mustaa, valkoista ja keltaista luettavuuden
  maksimoimiseksi.

Valinta näkyy heti, tallentuu vain puhelimeen ja säilyy päivitysten yli.
Järjestelmä-valinta reagoi Androidin teeman muutokseen myös sovelluksen ollessa
auki. Live-, Tehotesti- ja tallennetun ajon kuvaajat piirretään uudelleen
teemaväreillä. Vihreä onnistuminen, keltainen varoitus ja punainen virhe ovat
aina tilamerkityksiä eivätkä vaihdu teeman korostusvärin mukana. Jokaisen
paletin perusteksti, himmeä teksti ja pääpainike kuuluvat automaattiseen WCAG
AA -kontrastitestiin.

## Tehotesti 0.7.2

- Uusi **Tehotesti**-välilehti mittaa automaattisesti välit 0–100 km/h,
  80–120 km/h, 0–60 mph ja 60–120 km/h. Mukana on myös käyttäjän määrittämä
  nopeusväli. Rajanylitysten ajat interpoloidaan GPS-näytteiden väliin.
- Androidin natiivi GPS-silta käyttää monotonista aikaa ja vastaanottaa
  nopeuden, nopeustarkkuuden, korkeuden, suunnan sekä näytteen laatutiedot.
  Leveys- tai pituusastetta ei lueta, tallenneta eikä viedä raporttiin.
- OBD-yhteys on vapaaehtoinen. Kun yhteys on käytettävissä, GPS:n rinnalle
  tallennetaan auton nopeus, kierrosluku, kuormitus ja saatavilla olevat
  tehoon liittyvät arvot laadun ja ajotilanteen tarkastelua varten. Testi ei
  lisää uusia ECU-komentoja.
- Tehoarvio muodostuu liike-energian muutoksesta sekä syötettyyn massaan,
  tien kaltevuuteen, ilmanpaineeseen, lämpötilaan, vierintävastukseen ja
  ilmanvastukseen perustuvista vastustöistä. Huippu on noin sekunnin
  tehoikkunoiden robusti 90. persentiili, ei yksittäinen GPS-piikki.
- Tulos erottaa keskimääräisen ja huippupyörätehon sekä valitulla
  voimansiirron hyötysuhteella korjatun IS220d:n moottoriteho- tai CT 200h:n
  järjestelmätehoarvion. Kyse on ajonaikaisesta arviosta, ei dynamometrin
  mittaustuloksesta.
- Ajoneuvo-oletukset ovat muokattavia. IS220d:n vertailu on 130 kW / 177 DIN
  hv ja 0–100 km/h 8,9 s; CT 200h:n vertailu 100 kW / 136 DIN hv ja 0–100
  km/h 10,3 s. Todellinen kokonaismassa on syötettävä ennen vetoa.
- Laaturaportti tarkistaa muun muassa GPS-näytetaajuuden, suurimman
  näytevälin, vaaka- ja nopeustarkkuuden, ajosuunnan vakauden, GPS/OBD-
  nopeuseron ja valesijaintitiedon. Alle 1,5 Hz tai muuten heikko mittaus
  säilyttää kiihtyvyysajan mutta ei kelpaa tehovertailuun.
- TXT-raportti ja CSV sisältävät asetukset, väliajat, laatuarvion, varoitukset
  ja reitittömän raakadatan. Sovellus säilyttää enintään 12 aiempaa vetoa ja
  vertaa vain samaa ajoneuvoa sekä samaa nopeusväliä.

Testi tehdään turvallisesti puhelin kiinnitettynä tai matkustajan käyttämänä.
Nopeusrajoituksia on noudatettava; suuret nopeudet kuuluvat suljetulle
alueelle. Tasainen, kuiva ja tuuleton tie sekä vastakkaisiin suuntiin tehdyt
vedot pienentävät tie- ja tuulivirhettä.

## CT 200h -ostotarkastus 0.7.1

- CT-profiilissa näkyy uusi **Ostotesti**-välilehti. Kohteen vuosimalli,
  mittarilukema, tunniste ja huomiot tallentuvat raporttiin.
- Paikallaan tehtävä esitarkastus lukee EOBD:n MIL/readiness-tilan,
  tallennetut, odottavat ja pysyvät moottorikoodit, STFT/LTFT:n, EGR-arvot,
  matkan ja lämpenemiskerrat koodien nollauksesta, ohjainlaitteen jännitteen,
  ZWA10-tunnisteen, kaikki viisi HV-dataryhmää ja hybridiohjaimen koodit.
- Jarru-/luistonesto-ohjainta kokeillaan erillisellä vain lukevalla
  `7B0`/`7B8`-transaktiolla. Osoitus on tutkimuskandidaatti, ei fyysisellä
  CT:llä varmennettu julkaisu. Vain kelvollinen `53`-vastaus hyväksytään;
  `NO DATA`, aikakatkaisu tai tuntematon vastaus merkitään kattavuuspuutteeksi
  ja raportti ohjaa Techstream Health Checkiin.
- Koeajon näytteenotto vaatii yhtä aikaa tuoreen HV-virran ja kaikki 14
  lohkojännitettä. Näytteet luokitellaan automaattisesti paikallaan-, purku-
  ja regenerointivaiheisiin. Valmis kattavuus vaatii vähintään 3 / 5 / 5
  hyväksyttyä näytettä näistä vaiheista sekä vähintään 10 minuutin testijakson.
- Raporttia muodostettaessa sovellus lukee moottorin ja hybridiohjaimen
  vikakoodit uudelleen. Puuttuva koeajon jälkeinen uusintaluku jättää testin
  keskeneräiseksi.
- Raportti tarkistaa toistuvan alimman lohkon, kuormituksen lohkoeron,
  lämpötilat, vastusarvojen hajonnan, P0A80/P3000-,
  C1391/C1252/C1253/C1256-, P0401- ja P0300–P0304-koodit sekä mahdollisen
  tuoreen vikakoodien nollauksen.
- Flexin 0,200/0,300 V lohkoerot ovat näkyviä ostoseulontarajoja, eivät
  Lexuksen vikakoodi- tai korjausrajoja. Sovellus ei muodosta HV-akun
  kapasiteetti- tai SOH-prosenttia.
- Tulos on jokin neljästä: **keskeytä kauppa ja tutki**, **testi kesken**,
  **huomioita** tai **ei selkeää poikkeamaa tässä seulonnassa**. Puuttuva
  kuormitusvaihe tai ECU-vastaus ei voi muuttua vihreäksi tulokseksi.
- Raportti säilyttää esitarkastuksen raakavastaukset ja koeajon näytteet, ja
  sen voi tallentaa, kopioida tai jakaa ChatGPT:lle Androidin jakovalikolla.
- Ostotesti vaatii vLinker MC+:n tai muun ASCII-ELM327:n. Quicklynksin
  suljetulle FFF0/FFF6-kanavalle ei lähetetä CT:n valmistajakohtaisia pyyntöjä.

Tarkastus ei korvaa auton mekaanista nosturitarkastusta, jarrujen
ammattilaistarkastusta, huoltohistorian/VIN-kampanjoiden varmistusta tai
tarvittaessa Techstream Health Checkiä.

## Lexus CT 200h / ZWA10 0.7.0

- Ajoneuvovalinnat ovat **Lexus IS220d**, **Lexus CT 200h** ja
  **automaattinen tunnistus**. Automaatti hyväksyy CT-profiilin vain, jos
  hybridiohjaimen `21C1`-vastaus sisältää ZWA10-mallitunnisteen. Muussa
  tapauksessa se kokeilee IS220d:n varmennettua `217E`-lukua ja jättää
  tunnistamattoman auton yleiseen EOBD-tilaan.
- `ct200h-zwa10-gen3-hybrid-readonly-v1` määrittää 2ZR-FXE-hybridin,
  `7E2`-pyyntö- ja `7EA`-vastausotsakkeen, 201,6 V NiMH-akun, 28 moduulia ja
  14 kahden moduulin lohkoa. Profiili validoidaan sovelluksen käynnistyessä ja
  on syväjäädytetty `writable=false`-rakenteeksi.
- Hybridilive sisältää 52 suoraan purettua mittaria viidestä pyynnöstä:
  `2101` varaustila, `2181` lohkojännitteet, `2187` jäähdytysilma ja TB1–TB3,
  `2195` lohkojen sisäiset vastukset sekä `2198` akkuvirta, lataus- ja
  purkaustehojen rajat ja SOC-hajonta. Lisäksi akun teho johdetaan
  lohkojännitteiden summasta ja virrasta.
- Saman vastauksen arvot jaetaan yhdestä fyysisestä pyynnöstä. `2181` luetaan
  kerran, vaikka näkymässä olisi samanaikaisesti 14 lohkojännitettä, minimi,
  maksimi, ero ja lohkoindeksit.
- ISO-TP-purkaja vaatii ilmoitetun kokonaispituuden ja oikean jatkokehysten
  järjestyksen. Jokainen julkaistava arvo tarkistetaan profiilin
  järkevyysrajoihin. Katkennut tai epäuskottava vastaus säilyy diagnostiikassa
  mutta sitä ei näytetä mittausarvona.
- Hybridivikakoodit luetaan palveluilla `0A` ja `13B0`. Moottorin tavalliset
  EOBD-koodit säilyvät. CT-tilassa poistopainike on pois käytöstä ja
  `7E2`-transaktio palauttaa aina moottori-ECU:n `7E0`-otsakkeen ennen muuta
  pollausliikennettä.
- ASCII-ELM327, vLinker MC+ Classic ja vLinker MC+ BLE voivat käyttää
  hybridiprofiilia. Quicklynks FFF0/FFF6 säilyttää vain oman varmennetun
  standardi-OBD-polun; sen suljetulle binäärikanavalle ei arvata CT:n
  raw-CAN-kuoria.
- Tallenteen skeemaversio 5 ja CSV sisältävät ajoneuvoavaimen sekä
  profiiliversion. Raportit, tiedostonimet, ajonäkymä ja analyysipyyntö
  mukautuvat valittuun ajoneuvoon.
- Mukana on synteettinen CT-replay-fixture ja 12 CT-spesifiä regressiotestiä.
  Ne kattavat 14 lohkon monikehyksen, kaikki dekooderit, DTC-luvun,
  komentojärjestyksen, otsakkeen palautuksen, järkevyysrajat, UI-estot ja
  erillisen ELM327-emulaattoriskenaarion komentorajan.

CT-protokollatuki on toteutettu Techstream 12.20.024 -aineiston staattisen
Data List -tarkastelun, Lexus-korjausohjeen kenttänimien ja avoimen BETSY-
tutkimusaineiston perusteella. Techstreamia ei suoriteta eikä sen tiedostoja
jaeta sovelluksen mukana. Fyysisen CT 200h:n ensimmäinen kenttäajo kannattaa
tehdä auton ollessa paikallaan ja tallentaa raakavastaukset vertailua varten.

## Adaptive Live 0.6.8

- Live-arvot ryhmitellään todellisen pyyntölähteen mukaan. Esimerkiksi Mode
  01 PID `69`:n tavoite-, toteuma- ja poikkeama-arvot luetaan yhdellä
  `0169`-pyynnöllä. Samoin `217E`:n neljä DPNR-arvoa jaetaan yhdestä
  atomisesta Toyota-vastauksesta.
- Kierrosluku ja nopeus ovat 250 ms:n, nopeasti muuttuvat paine-, kuormitus-
  ja ilmamääräarvot 500–1000 ms:n, lämpötilat 1,0–5,0 sekunnin ja MIL-/matka-
  tiedot 15 sekunnin lähdeluokissa. Ajastus koskee pyynnön eräpäivää; se ei
  lupaa adapterin fyysistä näytetaajuutta.
- Pollausjono valitsee vanhimman erääntyneen lähteen ensin. Nopeasti muuttuvat
  arvot saavat etusijan tasatilanteessa, mutta hitaat arvot eivät voi jäädä
  jatkuvan nopean liikenteen alle.
- Kolmen onnistuneen vastauksen jälkeen ELM-aikakatkaisua voidaan lyhentää
  mitatun EWMA-vasteajan perusteella turvalliseen alarajaan asti. Ensimmäinen
  virhe palauttaa lähteen konservatiiviseen 2,2 s:n Mode 01- tai 5 s:n Toyota-
  aikakatkaisuun.
- `response pending`, tavallinen uusittava virhe, ei-uusittava NRC ja
  yhteyskatko saavat eri backoffin. Sovellus ei uusi komentoa kuljetuskerroksen
  sisällä eikä käynnistä live-lukua automaattisesti uudelleen yhteyskatkon
  jälkeen.
- Live-sivu näyttää lähteiden määrän, onnistuneet pyynnöt, mittauskadon ja
  vasteajan EWMA-arvon. Koeajon skeemaversio 4 tallentaa samat `poll_*`-tiedot
  jokaiselle CSV-näytteelle, jotta puuttuva arvo voidaan erottaa hitaasta tai
  epäluotettavasta yhteydestä.
- Toyota-arvoille tehdään profiilin määrittämä järkevyysaluetarkistus ennen
  live-näkymää. Arvoalueen ulkopuolista vastausta ei julkaista mittarina.
- Quicklynks FFF0/FFF6 käyttää edelleen omaa varmennettua pääkehys-, 2 s- ja
  15 s -ajoitustaan. Uusi ELM/vLinker-ajoitin ei muuta sen binäärikomentoja.
- Toteutus ei lisää Mode 04-, `3E00`-, `2E`-, `2F`-, Active Test-, ECU-
  kirjoitus- tai pakotetun regeneroinnin polkuja.

## IS220d-profiili ja replay-testaus 0.6.7

- `is220d-xe20-2ad-fhv-readonly-v1` kokoaa moottori-ECU:n `7E0`/`7E8`-
  osoitteet, kolme varmennettua Toyota `21xx` -pyyntöä, odotetut
  vastausalkut, vähimmäispituudet, dekooderit, kentät, yksiköt,
  järkevyysrajat, pollausvälimuistit ja evidenssitason yhteen validoituun
  profiiliin. Profiili, ECU, pyynnöt ja kentät ovat kaikki `writable=false`.
- Profiili validoidaan sovellusta ladattaessa. Väärä palvelu, komentokuori,
  tunniste, vastausalku, CAN-otsake, duplikaatti tai kirjoittava määrittely
  pysäyttää kehitysrakennuksen ennen Bluetooth-liikennettä.
- Toyota-livearvojen alustus ja ryhmäluku käyttävät atomista ECU-
  transaktiota. Asetukset, vastaanottosuodattimen tyhjennys, `ATSH7E0` ja
  varmennettu lukupyyntö pysyvät samassa komentojonon osassa, joten
  rinnakkainen Mode 01 -pollaus ei voi vaihtaa otsaketta niiden välissä.
- Yleinen NRC-parseri tunnistaa `7F <palvelu> <koodi>` -vastaukset ja erottaa
  esimerkiksi tuen puuttumisen, väärät olosuhteet, turvallisuuseston,
  varatun ECU:n ja `78 response pending` -tilan. Raporttiin tallennetaan
  palvelu, NRC-koodi, luokka ja tieto siitä, onko uusintayritys mielekäs.
- ISO-TP-yksikehyksen tai ensimmäisen monikehyksen ilmoittamaa kokonaispituutta
  seurataan. Väärä jatkokehysjärjestys tai kesken jäänyt hyötykuorma merkitään
  vajaaksi positiiviseksi vastaukseksi eikä sitä julkaista mittausarvona.
- Kehityspaketti sisältää deterministisen ELM-replay-kuljetuksen ja omat
  skenaariot positiiviselle `217E/217F/212C`-polulle, NRC:lle, `NO DATA`-,
  `CAN ERROR`-, katkennut monikehys- ja aikakatkaisutilanteille.
- Mukana on Flexin itse kirjoittama, vain luku -skenaario erikseen
  asennettavaan ELM327-emulaattoriin. Emulaattoria tai sen lähdekoodia ei
  sisällytetä APK:hon tai Flexin jakeluun.
- GitHub-löydöksistä käytetään itsenäisesti toteutettuja rakenneideoita.
  GPL-3.0- tai CC BY-NC-SA -koodia ei ole kopioitu Flexiin.

## vLinker MC+ -tuki 0.6.6

- **Bluetooth Classic / SPP:** parita Androidissa nimi `vLinker MC` tai
  `vLinker MC-Android`, tavallisesti PINillä `1234`. Flex priorisoi tämän
  kanavan saman adapterin BLE-mainoksen edelle.
- **Bluetooth LE:** valitse Flexissä `vLinker MC-IOS` tai `vLinker MC+`.
  BLE:tä ei pariteta Androidin Bluetooth-asetuksissa.
- Flex tunnistaa vLinkerin nimestä ja laajan testin vastauksista. Turvallinen
  capability-vaihe lukee `ATI`, `STI`, `STDI`, `AT@1`, `AT@2`, `ATRV`,
  `ATIGN`, `ATDP`, `ATDPN` ja `ATCS`; se ei nollaa adapteria eikä muuta auton
  tilaa.
- Kun vLinker-yhteys vastaa positiivisesti varmennettuihin `217E`, `217F` ja
  `212C` -lukuihin, Flex lisää seitsemän Toyota-arvoa live-näkymään:
  DPNR-paine-eron, rikki- ja PM-regeneroinnin tilat, polton aktiivisuuden,
  DPNR:n tulo- ja lähtölämmöt sekä EGR-asennon. Saman vastauksen useat arvot
  luetaan yhdellä ryhmäkyselyllä.
- BLE-silta tunnistaa FFF0/FFF1-yhdistelmäominaisuuden, vanhan FFF2→FFF1-
  jaon, FFE1:n, Nordic UARTin ja tuntemattoman saman palvelun kirjoitus- sekä
  ilmoitusominaisuudet. Valmistajan yksityisiä UUID-arvoja ei arvata.
- Notification/Indication-CCCD, GATT-kirjoitustapa, neuvoteltu hyötykuorma ja
  kuljetusprofiili näkyvät diagnostiikassa. Silta pyytää 517 tavun MTU:ta ja
  suurta yhteysprioriteettia; toteutunut hyötykuorma määräytyy Androidin ja
  adapterin neuvottelusta.
- Yhteyskatkon jälkeen Flex yrittää Classic- ja BLE-kanavilla hallittua
  uudelleenyhdistämistä 0,7 / 1,5 / 3 sekunnin viiveillä. Kesken jäänyttä
  komentoa, live-lukua tai tallennusta ei käynnistetä automaattisesti uudelleen.
- Adapterin MAC-osoite peitetään jaettavan laajan raportin oletusviennissä.

Ohjelmistopolut ja simuloidut testit ovat valmiit ennen adapterin saapumista.
Classic- ja BLE-kanavat merkitään kenttävarmennetuiksi vasta, kun sama APK on
ajettu fyysisellä vLinker MC+:lla autossa.

## Laajennettu GEKO- ja Toyota-testi 0.6.5

Yhteys-sivun **Aja GEKO + Toyota -testi** säilyttää aiemman klooniturvallisen
ELM/CAN-diagnostiikan ja lisää sen loppuun kolme 2AD-FHV:n `ECD_P3`-
määrityksistä varmennettua lukupyyntöä:

- `21 7E`: DPNR-paine-ero sekä rikki- ja PM-regeneroinnin tilat
- `21 7F`: pakolämpö ennen DPNR:ää ja DPNR:n jälkeen
- `21 2C`: EGR-venttiilin asento.

Testi ei enää vaadi onnistunutta `01 00` -vastausta ennen Toyota-lukuja.
Toyota-vaihe käynnistyy, kun Classic/SPP-yhteyden ELM-adapteri vastaa `ATI`-
kyselyyn sekä hyväksyy `ATSP6`- ja `ATSH7E0`-asetukset. Näin raportti erottaa
Gekon oman Mode 21 -kyvyn tavallisen EOBD-yhteyden ongelmasta.

Jokainen puuttuva positiivinen vastaus kokeillaan automaattisesti enintään
kolmella profiililla:

1. normaali ELM-automaattimuotoilu (`ATCAF1` ja `ATCFC1`)
2. sama pyyntö `7E8`-vastaanottosuodattimella
3. raaka kahdeksan tavun ISO-TP-yksikehys (`02 21 ID 00 00 00 00 00`).

Raakaprofiili käyttää kovaa kuuden komennon sallintalistaa. Sallitut komennot
ovat vain `217E`, `217F`, `212C` ja niiden kolme yllä kuvattua raakaversiota.
Raportti tallentaa yritysprofiilin, alkuperäisen vastauksen, mahdollisen
`7F 21 xx` -kielteisen vastauksen ja puretut arvot. Kaavat ovat:

- DPNR-paine-ero: `raw16 × 0,0039 − 5 kPa`
- molemmat pakolämmöt: `raw16 × 0,625 °C`
- EGR-asento: `raw8 × 100 / 255 %`.

Active Test-, Mode 04-, vikakoodien poisto-, ECU-kirjoitus- ja pakotetun
regeneroinnin komentoja ei lisätty. Quicklynksin FFF6-binääripolku säilyy
erillisenä eikä sille lähetetä Toyota `21xx` -komentoja.

## Androidin tiedostonvalitsin 0.6.3

Yhteys-sivun bugiraporttipainike avaa nyt Androidin järjestelmän
`ACTION_OPEN_DOCUMENT`-valitsimen. WebViewin `onShowFileChooser` välittää
valinnan natiiviaktiviteetille, ja valittu ZIP tai `btsnoop_hci.log` palautetaan
HTML-tiedostokentälle `FileChooserParams.parseResult`-käsittelyllä.

Keskeytetty valinta sekä aktiviteetin sulkeminen vapauttavat odottavan
`ValueCallback`-kutsun. Korjaus ei lisää tiedosto- tai internetoikeuksia eikä
muuta Bluetooth-, adapteri- tai ECU-komentopolkuja.

## Android-bugiraportin btsnooz-purku 0.6.4

Bugiraportin ZIPissä ei aina ole erillistä `btsnoop_hci.log`-tiedostoa. Flex
etsii silloin ZIPin pää-TXT:stä AOSP:n `--- BEGIN:BTSNOOP_LOG_SUMMARY`- ja
`--- END:BTSNOOP_LOG_SUMMARY`-merkintöjen välisen aineiston, purkaa sen
base64- ja zlib/deflate-kerrokset sekä muuntaa btsnooz v1- tai v2-tietueet
kelvolliseksi `btsnoop` HCI UART -lokiksi.

Erillinen btsnoop-tiedosto säilyy ensisijaisena lähteenä. Virheilmoitus erottaa
toisistaan tilanteet, joissa kumpaakaan lokimuotoa ei löytynyt ja joissa
`BTSNOOP_LOG_SUMMARY` löytyi mutta oli vioittunut. Purku tapahtuu täysin
paikallisesti eikä muuta auton kommunikaatiota.

## OBD Plus / Quicklynks BLE -jälkianalyysi 0.6.2–0.6.4

Yhteys-sivulla on uusi **BLE-liikennejäljen analyysi**. Se ei muodosta
Bluetooth- tai ECU-yhteyttä eikä lähetä yhtään komentoa. Toiminto hyväksyy:

- Android-bugiraportin ZIP-paketin
- suoraan puretun `btsnoop_hci.log`-tiedoston.

ZIPistä etsitään ensin `btsnoop_hci.log`, joka voi olla tallennettu ilman
pakkausta tai deflate-pakattuna. Ellei sitä ole, puretaan pää-TXT:n
`BTSNOOP_LOG_SUMMARY`. Btsnoop-parseri lukee HCI ACL-, L2CAP- ja ATT-rakenteet
ja käsittelee vain ATT Write Request/Command- ja Handle Value Notification/
Indication -tapahtumat.

Quicklynksin HCI-yhteys ja ATT-kahva tunnistetaan vain yhdistelmältä, jolla esiintyy jo autossa
varmennettu pituustavuun perustuva `41`- tai aiempi `61`-taulukkopyyntö. Vain
tämän yhteyden ja kahvan pyyntö- ja ilmoituspayloadit sisällytetään raporttiin. Muiden
Bluetooth-yhteyksien payloadit jätetään pois.

Raportti:

- ryhmittelee peräkkäiset TX-pyynnöt ja RX-ilmoituspalat
- laskee yksilölliset pyynnöt ja toistomäärät
- erottaa varmennetun live-taulukon, yksittäiset `02 41 PID` -luvut ja aiemmat
  `02 61 PID` -kokeet
- nostaa muut ASCII- tai binääripyynnöt tutkimuskandidaateiksi
- merkitsee `21 7E`/`21 7F`- ja `61 7E`/`61 7F` -osumat
- sisältää koneluettavan TSV-osion ja oman jakamisotsikon.

Tuntematonta pyyntöä ei siirretä automaattisesti Flexin lähetyslistaan.
Toyota `21 7E`, `21 7F` ja `21 2C` ovat käytössä vain dokumentoidulla
ASCII-ELM327-/GEKO-kuljetuksella. Quicklynksille niitä ei lähetetä ilman
erikseen varmennettua raw-CAN-komentokuorta.

Käyttö:

1. Ota Androidin kehittäjäasetuksista **Bluetooth HCI snoop log** käyttöön.
2. Käytä OBD Plus -sovellusta Quicklynksillä ja avaa sovelluksen data- sekä
   vikakoodinäkymät.
3. Luo Androidin bugiraportti.
4. Valitse ZIP tai purettu `btsnoop_hci.log` Flexissä. ZIPin sisäistä TXT:tä ei
   tarvitse purkaa käsin.
5. Jaa Flexin muodostama TXT-raportti analysoitavaksi.

## Quicklynksin laaja DPF/EGR-tutkimusdiagnostiikka 0.6.1

Kun Quicklynks on yhdistetty, Yhteys-sivulle avautuu erillinen
**Laaja DPF/EGR-tutkimusdiagnostiikka**. Se ajaa ensin kuusi lukittua
PID-tukibittikandidaattia `00`, `20`, `40`, `60`, `80` ja `A0`. Sen jälkeen se
testaa 15 lukittua kandidaattia kolmella kierroksella eli ajaa yhteensä 51
yksittäistä kyselyä:

- kontrollit `0C`, `05`, `0B` ja `10`
- EGR `2C`, `2D` ja `69`
- pakokaasu/jälkikäsittely `73`, `78` ja `79`
- DPF/PM `7A`, `7B`, `7C`, `8B` ja `8F`.

Jokainen pyyntö on täsmälleen Quicklynksin sallittu binäärinen
`02 41 PID` -lukukysely. Vastaus tarkistetaan auton koeajossa varmennetun
payload-only-rakenteen mukaan: `[pituus] [41] [hyötydata]`. PID ei toistu
vastauksessa. Hyväksyntä vaatii oikean vastaustyypin, PID-kohtaisen
hyötydatan pituuden, muun kuin tyhjän `00`-palautteen ja sen, ettei kehys ole
komennon kaiku tai jatkuva `13 41 …` -koontikehys.

Tukibittikandidaatti hyväksytään rakenteellisesti vain, jos `41`-tyypin jälkeen
on täsmälleen neljä tavua. Sitä ei silti pidetä yksin varmana ECU:n Mode 01
-tukikarttana, koska Quicklynks voi muodostaa payload-kuoren adapterissa ja
tunniste `80` esiintyy myös adapterin omassa koontikehyksessä.

Pitkissä vastauksissa Quicklynks aloittaa ensimmäisen BLE-ilmoituksen jälkeiset
jatkopalat `FF`-merkillä. Flex poistaa merkin vain ilmoituspalan alusta ja vain,
kun edellinen looginen pituustavuun perustuva kehys on kesken. Alkuperäiset
ilmoituspalat säilyvät raportissa. Ylipitkä, vääränpituinen tai nollatäytteinen
vastaus luokitellaan firmware-artefaktiksi tai ei-tuetuksi eikä mittausarvoksi.

Raporttiin tallennetaan jokaisesta kierroksesta:

- pyyntö, täydellinen raakavastaus ja todellinen vasteaika
- täydellisten kehysten määrä ja puskuriin jääneet tavut
- Androidin yksittäiset BLE-notifikaatiopalat ja niiden määrä
- tieto useasta notifikaatiosta kootusta tai useita kehyksiä sisältävästä
  vastauksesta
- normalisoitu vastaus ja poistettujen `FF`-jatkomerkkien määrä
- tukibittikandidaattien ilmoittamat PIDit ja erillinen artefaktiluokitus
- PASS/WARN/FAIL-luokitus ja PID-kohtainen kolmen kierroksen toistettavuus
- koneluettava TSV-osio.

Diagnostiikka käyttää aluksi varmennettua Quicklynks-mittarikehystä
moottorin kierrosluvun tarkistamiseen. Moottorin tila merkitään raporttiin
ensisijaisesti havaitusta RPM:stä; käyttäjän valinta toimii vain varatietona.

Tämä versio on tutkimusaskel, eikä vielä nimeä Quicklynksin tuloksia Toyota
DPNR -arvoiksi. Standardi-PIDin vastaukset pitää verrata Techstreamiin ennen
niiden hyväksymistä tuotantokäyttöön. Testi ei lähetä ELM-ASCII-komentoja,
Toyota `21xx` -kyselyjä, Active Testejä, Mode 04 -poistoa, ECU-kirjoituksia tai
pakotettua regenerointia.

## Diagnostiikkaraporttien tunnistus 0.6.1

- Laajan diagnostiikan tiedostonimi on muotoa
  `IS220d_Flex_laaja_diagnostiikka_<adapteri>_<aikaleima>_<tunniste>.txt`.
- Jokaisella ajolla on raportin sisälle tallennettu yksilöllinen
  raporttitunnus.
- Jakamisen otsikko erottaa Quicklynks-diagnostiikan, ELM/CAN-diagnostiikan ja
  koeajoanalyysin toisistaan.
- Jokainen tallennus- tai jakopyyntö luo uuden tiedostonimen.
- Moottorin käyntitila päätellään RPM:stä, kun dataa saadaan. Automaattitila ei
  enää kirjaudu virheellisesti arvoksi **ei**.

## Klooniturvallinen ELM327/CAN-yhteys ja diagnostiikka 0.5.1

Laaja diagnostiikka toimii ASCII-ELM327-yhteydellä myös silloin, kun
Bluetooth ja ELM vastaavat mutta moottori-ECU ei vielä vastaa. Se ajaa:

- 1,8 sekunnin asettumisviiveen Bluetooth-yhteyden ja `ATZ`-nollauksen jälkeen
- adapterin nykyisen `0100`-yhteystilan testin ennen nollausta
- hitaan `ATSP0`-automaattihaun ilman ennakkoon asetettua `ATSH`-otsaketta tai
  `ATCRA`-vastaanottosuodatinta
- erilliset väliaikaisen `ATTP6`- ja pakotetun `ATSP6`-CAN 11/500 -polut
- `ATAT2`- ja `ATAT1`-ajoitusten kokeilun sekä pakotetut yritysvälit myös
  silloin, kun klooni palauttaa `NO DATA` -vastauksen heti
- vaihtoehtoisten yhteyspolkujen pysäytyksen ensimmäiseen kelvolliseen
  `41 00` -vastaukseen
- `7DF`-yleisosoitteen ja suorien `7E0`–`7E7`-osoitteiden haun
- kierrosluvun, jäähdytysnesteen, MAFin ja MAPin perustestit
- vastaanottosuodattimen `7E0` → `7E8` -testin
- lyhyet ja täydet raa'at `01 00` -CAN-kehykset sekä `7DF`:lle että `7E0`:lle
- 20 sekunnin passiivisen `ATMA`-kuuntelun ja hallitun paluun komentotilaan
- tuettujen PIDien alueet, keskeiset moottoriarvot, vikakoodit ja Mode 09
  -ECU-tunnisteet
- Toyota `21 7E` -lukukyselyn vain, jos suora `7E0/0100` ja vähintään kaksi
  kolmesta perustiedosta on ensin varmennettu
- ELM-asetusten ja parhaan löytyneen pyyntöosoitteen palautuksen.

Jokaisesta vaiheesta raporttiin tallennetaan komento, pyyntöosoite, yhteyspolku,
aikakatkaisu, todellinen kesto, PASS/WARN/FAIL/SKIP, tulkinta, virhe ja
siivoamaton raakavastaus. Raportin lopussa on lisäksi koneluettava TSV-osio.
`ATCS` kirjataan faktana, mutta siitä ei tehdä yksin fyysistä CAN-vikapäätelmää,
koska ELM327-kloonit voivat toteuttaa komennon puutteellisesti.

Käyttö:

1. Yhdistä GEKO tai muu ASCII-ELM327 Flexissä.
2. Merkitse, käykö moottori, ja kirjoita halutessasi oire.
3. Paina **Aja GEKO + Toyota -testi** ja anna testin valmistua.
4. Paina **Jaa raportti ChatGPT:lle**.

Raportti tallennetaan ja jaetaan vain käyttäjän pyynnöstä Androidin
jakovalikon kautta. Sovelluksessa ei ole internetoikeutta.

## GEKO / Bluetooth Classic -diagnostiikka 0.4.3

Classic-yhteys erotetaan nyt kolmeen vaiheeseen:

1. Bluetooth-sarjayhteys adapteriin
2. ELM327:n vastaus ja alustus
3. moottorinohjauksen kelvollinen `41 00` -vastaus kyselyyn `01 00`.

Vihreä **ECU yhdistetty** näytetään vasta kolmannen vaiheen jälkeen. Jos
Bluetooth ja ELM327 toimivat mutta ECU ei vastaa, yhteys jää auki
diagnostiikkaa varten ja tila näkyy keltaisena. Kaikki TX-komennot sekä
siivoamattomat RX-vastaukset tallentuvat kopioitavaan ELM/ECU-lokiin.

Automaattisen `ATSP0`-haun epäonnistuessa sovellus kokeilee kerran Lexuksen
oikeaa ISO 15765-4 CAN 11 bit / 500 kbit/s -protokollaa komennolla `ATSP6`.
Yhdistämisprobe ja GEKO-testi käyttävät vain moottorinohjauksen lukukomentoja.

Erillisessä **Aja GEKO-testi** -toiminnossa luetaan ensin:

- `0100` tuetuille yleisille PIDeille
- `010C` kierrosluvulle
- `0105` jäähdytysnesteelle
- `0110` ilmamassalle.

Toyota `ATSH7E0` + `21 7E` lähetetään vasta, kun `0100` toimii ja vähintään
kaksi kolmesta perustiedosta palauttaa oikean `41 PID` -vastauksen. Testi ei
käynnistä DPNR-polttoa eikä muuta ECU:n asetuksia. Fyysinen otsake palautetaan
lopuksi yleiseen `7DF`-osoitteeseen, otsakkeet piilotetaan ja `0100` luetaan
uudelleen. Positiivinen `61 7E` tallennetaan tässä versiossa raakadatana;
DPNR-mittarit lisätään vasta autosta saadun tavurakenteen varmistamisen jälkeen.

## Quicklynks BK-BLE-1.0

Varmennettu laiteprofiili:

- mainostettu nimi `OBD`
- palvelu `0000fff0-0000-1000-8000-00805f9b34fb`
- liikenneominaisuus `0000fff6-0000-1000-8000-00805f9b34fb`
- CCCD `00002902-0000-1000-8000-00805f9b34fb`
- FFF6: Notify, Read ja Write Without Response
- binäärikehyksen ensimmäinen tavu kertoo sitä seuraavien tavujen määrän

Yksittäiskyselyn varmennettu rakenne on:

```text
pyyntö:   [02] [41] [tunniste]
vastaus:  [pituus] [41] [arvotavut]
```

Vastaus ei toista pyydettyä tunnistetta. Esimerkiksi `02 41 0C` palautti
`03 41 15 80`, josta `0x1580 / 4 = 1376 rpm`, ja `02 41 7F` palautti
`03 41 05 87`, josta `0x0587 / 100 = 14,15 V`.

Varmennettu reaaliaikakysely:

```text
0D410C0D848005857F8182048683
```

Varmennettu esimerkkivastaus:

```text
13410C800000022680000E04DA00100C660343FF
```

Tästä vastauksesta sovellus tulkitsee seuraavat arvot:

- `0C80 / 4 = 800 rpm`
- seuraava `00 = 0 km/h`
- `0002 = 2 km` Quicklynksin ajokertymä, ei auton matkamittari
- `26 / 10 = 3,8` Quicklynks-kenttä 80, jonka merkitys ja yksikkö ovat avoimia
- `80 - 40 = 88 °C` jäähdytysneste
- `04DA × 0,01 = 12,42 V` adapterin käyttöjännite
- `66 × 100 / 255 = 40 %` laskennallinen moottorin kuormitus
- `0343 = 835 s` moottorin käyntiaika

RPM ja nopeus oli jo varmennettu auton kenttätestillä. Uusien kenttien
sijainnit ja kaavat tarkistettiin valmistajan OBD Plus 4.1.6 -sovelluksen
samalle 19 tavun mittarikehykselle tekemästä jäsennyksestä. Kolmen
29.7.2026 tallennetun IS220d-koeajon perusteella kenttä `80` ei ole
standardi-MAF eikä polttoainevirta. Flex käyttää siksi neutraalia nimeä
`quicklynksField80` eikä liitä arvoon yksikköä tai moottoriteknistä
tulkintaa.

Valmistajan APK:n SHA-256
`EBEB958F3502C1EA004CC67FC1EA5BD55F9DB1C82802819FC0B9A5250FC76703`
vastasi julkisen jakelusivun ilmoittamaa tiivistettä. Valmistajan koodia tai
verkkotoimintoja ei ole siirretty Flexiin.

Kentät `84` ja `86` varmennettiin ajomatkaksi ja käyntiajaksi vertaamalla
niitä saman ajon standardiarvoihin. Kentät `85`, `81`, `82` ja `83` jätetään
edelleen näkyviin raakadatana.

## Tuotantolukuryhmät

Quicklynksin lisäarvot luetaan kahdella ennalta lukitulla vain luku
-kyselyllä:

- fast, noin 2 sekunnin välein: MAP `0B`, MAF `10`, rail-paine `23`,
  kaasupoljin D/E `49`/`4A` ja kaasuläppätoimilaitteen pyyntö `4C`
- slow, noin 15 sekunnin välein: MIL ja ECU:n ilmoittama vikakoodimäärä
  `01`, imuilman lämpö `0F`, käyntiaika `1F`, matka vikakoodien nollauksesta
  `31`, ilmanpaine `33` ja ECU-jännite `42`.

`adapterVoltage` on Quicklynksin pääkehyksen adapterijännite. `voltage` on
erillinen standardin PID `42` ECU-jännite. `boostPressure` lasketaan
arvona `MAP − ilmanpaine`, ja se merkitään aina johdetuksi arvoksi eikä
ECU:n ahtopainepyynnöksi.

Jokaiselle ryhmälle on oma aikaleima. CSV:n `*_age_ms`-sarakkeet kertovat,
kuinka vanha arvo oli näyterivin hetkellä. Jos ryhmä epäonnistuu kahdesti
peräkkäin, vain kyseinen lisäryhmä asetetaan 60 sekunnin tauolle; normaali
Quicklynks-pääkehys jatkaa toimintaansa.

## Standardoidut diesel-lisäarvot

Flex 0.4.2 sisältää AndrOBD:n mukana olevista standardi-OBD-määrittelyistä
tarkistetut Mode 01 -muunnokset seuraaville ryhmille:

- lambda, EGR-pyyntö ja EGR-poikkeama (`24`, `2C`, `2D`)
- katalysaattorilämmöt ja ruiskutusajoitus (`3C`, `3E`, `5D`)
- EGR:n tavoite/toteuma, rail-paineen tavoite/toteuma ja polttoainelämpö
  (`69`, `6D`)
- ahtopaineen tavoite/toteuma ja VGT:n tavoite/toteuma (`70`, `71`)
- pakopaine, pakokaasulämmöt sekä DPF:n paineet ja lämpötilat
  (`73`, `78`, `7A`, `7C`)
- standardin ilmoittama DPF-regenerointitila ja kuormitus, diesel-lambda
  sekä PM-anturin regenerointitila (`8B`, `8C`, `8F`).

Quicklynksillä jokainen ehdokas lähetetään kiinteänä `02 41 XX`
-lukupyyntönä enintään kerran 1,2 sekunnissä. Mittari ilmestyy vasta, kun
lyhyt vastaus alkaa tyypillä `41`, sen payload-pituus sopii kysytyn kentän
rakenteeseen ja tulos voidaan tulkita äärelliseksi luvuksi. PID-tunnistetta
ei odoteta vastauksesta. Komennon kaiku, tyhjä `02 41 00` -palaute ja jatkuva
`13 41 …` -koontikehys hylätään. Hylättyä PID:iä
kokeillaan uudelleen aikaisintaan 120 sekunnin kuluttua. Puuttuva valinnainen
PID näkyy vain yhteysdiagnostiikassa eikä merkitse koeajonäytettä virheelliseksi.

Quicklynksin tunnistetta `86` ei käytetä standardin hiukkasmassapitoisuuteen,
koska varmennetussa Quicklynks-pääkehyksessä sama tunniste tarkoittaa
käyntiaikaa. Tavallinen ASCII-ELM327 voi edelleen käyttää standardi-PID:iä
`86`, jos ECU ilmoittaa sen tuetuksi.

Koeajo-näkymän polttoilmaisin käyttää standardia PID:iä `8B`, jos auto palauttaa
sille hyväksytyn payload-only-vastauksen. Toyota `21 7E` -DPNR-tilaa ei saada
Quicklynksin nykyisellä rajapinnalla, joten ilmaisin ei voi sen perusteella
vahvistaa polttoa.

## Techstreamin 2AD-FHV-arvot ja Quicklynks-rajaus

Techstream 12.20.024:n EU-tietokannassa Lexus IS220d:n `2AD-FHV` linkittyy
`ECD_P3.ddb`-moottorinohjaukseen. Tietokannasta varmistettiin seuraavat
Toyota Read Data -tunnisteet:

- `21 7E`: DPNR-paine-ero sekä rikki- ja PM-regeneroinnin tilat
- `21 7F`: pakolämpö ennen ja jälkeen DPNR:n
- `21 93`: polttoaineen lämpötila
- `21 96`: common rail -paine
- `21 9C`: suutinkorjaukset 1–4
- `21 AF`: ruiskutusajoitus
- raakadatana `21 91`, `21 92`, `21 97`, `21 9A`, `21 9F`, `21 AD` ja `21 AE`.

Flex 0.4.1 kokeili niitä Quicklynks-kuorella `02 61 XX`. Kaikki 13 pyyntöä
palauttivat `02 61 00`, joka on adapterin tyhjä palaute eikä ECU:n
`61 PID …` -vastaus. Flex 0.4.2 ei enää lähetä näitä pyyntöjä eikä näytä niiden
perusteella DPNR-, suutin- tai Toyota-mittareita. Käyttöönotto vaatii ensin
Quicklynksin dokumentoidun RAW/CAN-komennon tai erillisen aidon ELM327- tai
J2534-yhteyden.

Käytetyt Techstream-kaavat ovat:

- DPNR-paine-ero: `raw16 × 0,0039 − 5 kPa`
- pakolämpötilat: `raw16 × 0,625 °C`
- polttoainelämpö: `raw8 − 40 °C`
- rail-paine: `raw8 MPa`
- suutinkorjaukset: `raw8 × 10 / 64 − 10 mm³`
- ruiskutusajoitus: `(raw16 − 900) / 10 °CA`.

DPNR-tilakoodit ovat tietokannassa `0 = Standby`, `1 = Ready`, `2 = Operate`
ja `3 = Complete`, mutta niitä ei tulkita Quicklynks-datasta. DPNR:n
noki-/tuhkamassaa, IMV/SCV-arvoja, Exhaust Fuel Addition -palautetta tai
5. suuttimen tilaa ei ole lisätty.

## PID-tutkimus

Tutkimus käynnistyy automaattisesti vain, kun Quicklynks on yhdistetty ja
koeajotallennus on käynnissä. Käyttöliittymään ei lisätty uutta painiketta.

Tutkimussuunnitelmassa on 55 ennalta rajattua pyyntöä:

- ensin lähetetään jälkikäsittelyn viisi standardiehdokasta `78`, `79`,
  `7A`, `7B` ja `7C`
- sitten kahdeksan standardoitua dieselryhmää `69`, `6D`, `70`, `71`, `73`,
  `8B`, `8C` ja `8F`
- sitten varmennetussa koontikyselyssä jo olevat 12 tunnistetta lähetetään
  yksitellen kenttärajojen selvittämiseksi
- sen jälkeen kokeillaan 30 standardi Mode 01 -tunnisteeseen perustuvaa
  ehdokasta, kuten MAP-, MAF-, rail pressure-, EGR-, ilmanpaine-, kuormitus-,
  kaasupoljin-, ruiskutusajoitus-, ahtopaine-, DPF- ja diesel-lambdaehdokkaita.

Jokainen pyyntö on täsmälleen `02 41 XX`: pituustavu `02`, vain luku
-kyselytyyppi ja yksi sallitun listan tunniste. Sovellus ei skannaa koko
`00–FF`-avaruutta, muodosta raakakäyttäjäkomentoja eikä lähetä Toyota Read
Data 21-, Mode 22-, Active Test-, vikakoodien poisto- tai muita
kirjoituskomentoja.

Ensimmäinen pyyntö tehdään aikaisintaan neljän sekunnin kuluttua tallennuksen
alusta. Sen jälkeen lähetetään enintään yksi pyyntö 10 sekunnissä, ja yhden
pyynnön aikakatkaisu on 750 ms. Aikakatkaisu tai tuntematon vastaus tallennetaan
tutkimustulokseksi eikä pysäytä koeajolokia. Tutkimuspyynnön vastausta ei syötetä
normaalin mittarikehyksen parseriin.

Raakavastaus säilytetään ilman mittariarvoa, yksikköä tai muunnoskaavaa.
Tutkimusrivin `payload_hex` sisältää `41`-tyypin jälkeiset arvotavut eikä PID:iä.
Pyynnön tunniste ja vastaus yhdistetään sarjallisen yhden kyselyn jonon avulla.
`aftertreatment_standard_candidate`- ja `standard_read_candidate`-ryhmien
nimet ovat vain tutkimushypoteeseja. Tunnisteet `78–7C` eivät ole
Techstreamin `DPNR Status Reju (PM/S)` -tiloja. Uusi arvo
voidaan lisätä varsinaiseen lokitukseen vasta, kun tunniste, vastausrakenne,
tavujärjestys, asteikko ja yksikkö on varmennettu autossa.

Virheellisesti käyttäytynyt `60`-tukibittikysely on edelleen poistettu
koeajotallennuksen automaattisesta 55 PIDin tutkimusjonosta. Flex 0.6.1:n
käyttäjän erikseen käynnistämä laaja diagnostiikka kokeilee sen kerran
tukibittikandidaattina ja säilyttää tuloksen raakadatana/artefaktiluokituksena;
se ei ohjaa tuotantomittareita.

## Yhteyden muodostaminen

1. Kytke lukija auton OBD-porttiin ja virrat päälle.
2. Sulje iPhonen Bluetooth sekä muut adapteria käyttävät OBD-sovellukset.
3. Salli OnePlussassa **Lähellä olevat laitteet**.
4. Avaa **IS220d OBD Flex** ja paina **Päivitä** kerran.
5. Odota enintään 15 sekunnin BLE-haun valmistuminen.
6. Valitse joko löydetty `OBD · BLE` tai, jos Android ei palauttanut lukijaa,
   `Motonet OBD (suora GATT-varmistus)`.
7. Paina **Yhdistä**.

Quicklynksia ei pariteta Androidin Bluetooth-asetuksissa. Sovellus avaa GATT-yhteyden suoraan.

Kun FFF0/FFF6 löytyy, sovellus:

1. sulkee mahdollisen vanhan GATT-yhteyden
2. löytää FFF6:n ja valitsee Quicklynks-binääriprotokollan
3. ottaa FFF6-ilmoitukset käyttöön CCCD-arvolla `0100`
4. odottaa GATT- ja notification-alustuksen valmistumista
5. lähettää kyselyn Write Without Response -toiminnolla
6. kokoaa pirstoutuneet kehykset ja erottaa samaan ilmoitukseen yhdistetyt kehykset
7. estää päällekkäiset kyselyt ja aikakatkaisee vastaamattoman kyselyn

FFF0/FFF6-laitteelle ei lähetetä ASCII-ELM327-alustusta tai `ATI`-komentoa.

## Säilytetyt ominaisuudet

- paritettujen Bluetooth Classic / SPP ELM327 -adapterien tuki
- muiden läpinäkyvien BLE-ELM327-profiilien tuki
- tavallinen ELM327-alustus, EOBD-vikakoodit ja vikakoodien poisto
- standardoidun Mode 01 -live-datan PID-tunnistus ja kuvaajat
- koeajoloki, tapahtumamerkit, paikallinen IndexedDB-tallennus ja CSV-vienti
- tallennetun ajon oirekuvaus ja jakaminen tekoälyanalyysiin Androidin
  jakovalikolla
- turvallisiin lukukomentoihin rajattu raakaterminaali
- paikallinen IS220d-simulaattori

Quicklynksin normaalissa live-datassa Flex 0.4.2 käyttää varmennettua
pääkehystä sekä yllä kuvattuja fast/slow-ryhmiä. PID-tutkimuspyynnöt ovat
erillisiä ja käytössä vain koeajotallennuksen aikana. Mode 22-, Active Test-,
vikakoodien poisto- ja raakaterminaalikomennot estetään Quicklynks-yhteydellä.

Tavallisella ELM327-yhteydellä polttoainevirta käyttää standardoitua Mode 01
PID-arvoa `5E` ja näkyy vain, jos auton ECU ilmoittaa tukevansa sitä.

## CSV ja tekoälyanalyysi

Tallennetun ajon **Jaa tekoälyanalyysiin** -painike:

1. tallentaa käyttäjän kirjoittaman oireen tai havainnon sessioon
2. luo skeemaversion 3 CSV-tiedoston
3. lisää analyysipyyntöön auton, adapterin, protokollan, mittariselitteet ja
   tunnetut rajoitukset
4. avaa Androidin jakovalikon, josta käyttäjä valitsee esimerkiksi ChatGPT:n
5. lähettää valitulle sovellukselle CSV:n ja analyysipyynnön.

CSV sisältää jokaisella rivillä session metatiedot sekä `timestamp`,
`elapsed_ms`, `sample_gap_ms`, käytettävissä olevat mittarit yksikköineen ja
`*_age_ms`-ikätietoineen, tapahtumamerkin, yhteystilan ja virheen. Vanhojen
Quicklynks-sessioiden `fuelRate`/`adapterMaf` viedään neutraalina
`quicklynksField80`-kenttänä ilman yksikköä. Vanha Quicklynks-`voltage`
viedään nimellä `adapterVoltage`.

Sekä tavallinen **Tallenna CSV** että tutkimusvienti sisältävät UTF-8 BOM:n,
käyttävät puolipiste-erotinta ja desimaalipilkkua. Kun
uudessa Quicklynks-ajossa on PID-tutkimustapahtumia, **Jaa tekoälyanalyysiin**
luo erillisen tutkimus-CSV:n. Siinä:

- `record_type=sample` tarkoittaa tavallista koeajonäytettä
- `record_type=pid_probe` tarkoittaa raakaa yksittäistunnisteen tutkimusta
- pyyntö, vastaus, vastaustyyppi, hyötydata, kesto ja virhe ovat omissa
  sarakkeissaan
- lähimmän tavallisen näytteen mittarit auttavat vertaamaan raakakenttää
  ajotilanteeseen
- UTF-8 BOM, puolipiste-erotin ja desimaalipilkku estävät suomalaisen Excelin
  `12.44` → `1.12.2044` -päivämäärämuunnoksen.

Analyysipyyntö käskee tekoälyä erottamaan mitatut havainnot tulkinnoista,
tarkistamaan näytekatkot ja välttämään osien vaihtosuositusta pelkän
korrelaation perusteella. Pyyntö erottaa mahdolliset standardoidut Mode 01
-lisäarvot Lexus/Techstream-kohtaisista arvoista. Se kertoo, ettei Quicklynks
tuota Toyota-kohtaisia suutinkorjauksia tai DPNR:n paine-, lämpötila- ja
regenerointitiloja eikä Flex sisällä DPNR-noki- tai tuhkamassoja, IMV/SCV-arvoja
tai 5. suuttimen tilaa.

## BLE-diagnostiikka

BLE-haku käynnistetään Androidin pääsäikeellä. Jos ensimmäinen haku ei saa
yhtään callbackia, Flex kokeilee automaattisesti seuraavia vaiheita:

1. suodattamaton oletushaku
2. suodattamaton `LOW_LATENCY`-haku
3. `OBD`-nimisuodatettu `LOW_LATENCY`-haku

Jos kaikki kolme jäävät ilman tuloksia, käyttäjän testissä varmennettu Motonetin
osoite `25:28:07:06:00:66` lisätään valittavaksi suoraa GATT-yhteyttä varten.

**Kopioi BLE-diagnostiikka** sisältää:

- Bluetooth-oikeudet ja BLE-haun tulokset
- käytetyt hakuvaiheet, niiden callback-määrät, skannauksen keston ja viimeisen hakutavan
- laitteen nimen, osoitteen, RSSI:n ja mainostetut palvelut
- GATT-yhteysyritykset ja hallitun uudelleenyhdistämisen
- löydetyt FFF0-, FFF6- ja CCCD-UUID:t
- notification/CCCD-tilan
- TX- ja RX-tavut HEX-muodossa
- pirstoutuneen tai valmistuneen kehyksen jäsennyksen
- virheellisen kehyksen hylkäyksen
- aikakatkaisut ja yhteyskatkot

## Yksityisyys

Sovellus käsittelee tiedot vain puhelimessa. Manifestissa ei ole
`INTERNET`-oikeutta, selväkielinen verkkoliikenne on estetty eikä projekti
sisällä Quicklynks-palvelinyhteyksiä, GPS-lähetyksiä, seurantaa tai
analytiikkaa. Tekoälyjako tapahtuu vain Androidin jakovalikosta käyttäjän
valitsemalle sovellukselle.

## Versio ja päivitys

- käyttäjälle näkyvä nimi: `Lexus OBD Flex`
- `applicationId`: `fi.oliver.is220dobd` (muuttumaton)
- `versionName`: `0.8.1`
- `versionCode`: `801`
- allekirjoitusidentiteetti: sama kuin Flex 0.2.1:ssä

Debug- ja release-APK käyttävät tarkoituksella samaa aiemman Flexin allekirjoitusidentiteettiä, jotta kumpikin voidaan asentaa 0.2.1:n päälle. Release-paketti sisältää minifioidun käyttöliittymäkoodin; debug-paketti sisältää lukukelpoisemman nipun.

## Rakentaminen

Vaatimukset:

- Node.js 18 tai uudempi
- Java Runtime 8 tai uudempi

```bash
npm ci
npm test
npm run build
```

Rakennus toimii ilman Android SDK:n tai Android Studion erillistä asennusta. Tarvittava AAPT2 on projektin lukitussa npm-riippuvuudessa, ja Android-kehysresurssi poimitaan paikallisesti Apktool-paketista. Rakennus ei lisää internetoikeutta APK:hon.

Tulokset:

```text
dist/Lexus_OBD-Flex-0.8.1-debug.apk
dist/Lexus_OBD-Flex-0.8.1-release.apk
```
