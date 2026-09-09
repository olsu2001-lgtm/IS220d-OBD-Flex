# Lexus OBD Flex 0.7.7 · IS220d-suutintesti

## Mitä testi tekee

Suutinten tasapainotesti on Lexus IS220d / 2AD-FHV -moottorin vain lukeva
OBD-seulonta. Se kerää noin 45 sekunnin ajan:

- kierrosluvun (`010C`)
- jäähdytysnesteen lämpötilan (`0105`)
- polttoaineen lämpötilan (`2193`)
- common rail -paineen (`2196`)
- sylinterien 1–4 ruiskutuskorjaukset (`219C`).

Testi ei käynnistä Techstreamin Active Test -toimintoja eikä lähetä
kirjoitus-, poisto-, koodaus- tai regenerointikomentoja.

## Testin suorittaminen

1. Valitse tai tunnista `Lexus IS220d · XE20 · 2AD-FHV`.
2. Yhdistä vLinker MC+:lla tai muulla ASCII-ELM327-adapterilla. Quicklynksin
   FFF6-binääripolku ei tue Toyota 21xx -kyselyitä.
3. Lämmitä moottori normaalilämpöön ja pysäköi ulos tai hyvin tuuletettuun
   tilaan.
4. Vaihde vapaalle, seisontajarru päälle. Sammuta A/C, valot,
   takalasinlämmitin ja muut lisälaitteet.
5. Avaa `Suuttimet`, vahvista olosuhteet ja aloita 45 sekunnin testi.
6. Älä koske kaasuun mittauksen aikana.
7. Kun raportti valmistuu, valitse `Jaa raportti tekoälylle`, `Tallenna .txt`
   tai `Kopioi raportti`.

## Tulkinta

Lexus-korjaamokäsikirjan Data List -ohjeen tavanomainen alue jokaiselle
`Injection Feedback Val #1–#4` -arvolle on lämpimällä tyhjäkäynnillä
`−3,0…+3,0 mm³`. Korjausarvon itseisarvon huoltoraja on `4,9 mm³`.

- Positiivinen arvo tarkoittaa, että ECU lisää kyseisen sylinterin
  ruiskutusmäärää palamisen heikkouden tasapainottamiseksi.
- Negatiivinen arvo tarkoittaa, että ECU vähentää määrää liiallisen
  palamispaineen tasapainottamiseksi.
- Yksittäinen piikki ei ole sama asia kuin jatkuva poikkeama. Flex raportoi
  mediaanin, minimin, maksimin, hajonnan ja rajan ylitysten määrän.

Suutinkorjausarvo ei yksin todista sisäistä tai ulkoista vuotoa eikä määrää
suutinta vaihdettavaksi. Poikkeava tulos voi edellyttää suuttimien
paluuvirta-/leak-off-testiä, puristusmittausta, korkeapainepuolen
vuototarkastusta ja ammattilaisen Techstream-varmennusta.

## Tekoälyraportti

TXT-raportti sisältää:

- sovellus-, ajoneuvo-, adapteri- ja testiolosuhteet
- Flexin alustavan luokituksen ja kaikki raja-arvot
- sylinterikohtaiset tilastot
- CAN-alustuksen raakavastaukset
- jokaisen näytteen ajan, arvot, raakavastaukset ja virheet
- tekoälylle valmiin analyysiohjeen, joka kieltää varman vuotopäätelmän
  pelkistä korjausarvoista.
