# Lexus OBD Flex 0.7.4 · ajoneuvotunnistus

## Mitä muuttui

Flex tunnistaa tavalliseen ASCII-ELM327:ään tai vLinker MC+:aan yhdistetyn
tuetun auton jokaisella yhteyskerralla. Uuden asennuksen oletus on
**Automaattinen tunnistus (suositus)**. Aiemmin tallennettu IS220d- tai
CT 200h -käsivalinta säilyy varaprofiilina, mutta onnistunut tunnistus valitsee
oikean profiilin automaattisesti.

Tunnistus käyttää vain seuraavia lukukomentoja:

| Lähde | Osoite | Pyyntö | Käyttö |
|---|---:|---:|---|
| Standardi EOBD | `7E0/7E8` | `0902` | 17-merkkinen VIN |
| CT 200h hybridiohjain | `7E2/7EA` | `21C1` | ZWA10-mallitunniste |
| IS220d moottoriohjain | `7E0/7E8` | `217E` | 2AD-FHV DPNR-ryhmä 1/3 |
| IS220d moottoriohjain | `7E0/7E8` | `217F` | 2AD-FHV DPNR-ryhmä 2/3 |
| IS220d moottoriohjain | `7E0/7E8` | `212C` | 2AD-FHV EGR-ryhmä 3/3 |

Kaikki pyynnöt ovat kiinteitä vain luku -pyyntöjä. Tunnistus ei lähetä Mode
04-, Active Test-, kirjoitus-, koodaus- tai pakkoregenerointikomentoja.
Jokainen otsaketransaktio on atominen ja palauttaa pyyntöotsakkeen `7E0`:aan.

## Päätössäännöt

- CT 200h tunnistetaan ZWA10-mallitunnisteesta tai varmennetusta CT-VIN-
  etuliitteestä. Yhteensopivat VIN- ja ZWA10-tiedot tuottavat varman
  tunnistuksen.
- IS220d tunnistetaan varmennetusta IS-VIN-etuliitteestä tai kaikkien kolmen
  2AD-FHV-lukuryhmän täydellisestä vastauksesta. Yhteensopiva VIN + 3/3
  lukuryhmää tuottaa varman tunnistuksen.
- Yksi tai kaksi IS220d-lukuvastausta ei riitä automaattiseen valintaan.
- Ristiriitaiset VIN- ja ECU-tiedot estävät automaattisen profiilinvaihdon.
- Jos tietoa ei saada, käytetään nimenomaisesti käsin valittua varaprofiilia
  tai yleistä EOBD-tilaa.

Yhteys-sivun **Tunnista auto uudelleen** -painike ajaa tunnistuksen uudestaan.
Live-luku, tallennus, tehotesti ja diagnostiikka on pysäytettävä ensin.

## Quicklynks-rajoitus

Quicklynks FFF6 käyttää omaa varmennettua binääriprotokollaansa. Sille ei ole
varmennettu turvallista VIN- tai Toyota-mallitunnisteen komentokuorta, joten
Flex ei arvaa autoa tämän polun kautta. Käsivalinta ja nykyinen yleinen
Quicklynks-OBD-luku toimivat ennallaan.

## Kenttätesti

1. Kytke sytytysvirta ja OBD-lukija.
2. Valitse Yhteys-sivulta **Automaattinen tunnistus (suositus)**.
3. Yhdistä. Odota, kunnes tunnistusteksti näyttää auton, alustan, moottorin ja
   mahdollisen VIN-tunnisteen.
4. IS220d:llä odotettu tulos on `Lexus IS220d · XE20 · 2AD-FHV`.
5. CT 200h:llä odotettu tulos on `Lexus CT 200h · ZWA10 · 2ZR-FXE`.
6. Jos tulos on ristiriitainen tai tuntematon, kopioi ELM/ECU-loki. Älä käytä
   Toyota-kohtaisia livearvoja ennen oikean käsiprofiilin valintaa.

VIN ja tunnistus käsitellään paikallisesti. Appi ei pyydä internetoikeutta.
