# Suggested tracks

Every DJ drill names two or three records to load into rekordbox, with the deck to put them
on and where in the record the drill's move happens. This file is the research behind
`content/tracks.json` (the pool) and the `tracks` field on each drill.

## Selection rules

- **Classic DJ staples** with extended or club mixes: records DJs already learn on, easy to
  find on Beatport or in a rekordbox library, with structures that follow the 8/16/32-bar
  phrase convention.
- **BPM and key are verified** for every record against the Tunebat, Beatport, Discogs or
  AudioKeychain page linked in its `url` and stored as Camelot keys. Nothing in the pool is
  quoted from memory. Verification level: the research environment could not fetch those
  pages directly (its network policy blocks them), so each value was read from the page's
  own indexed listing as returned by web search restricted to that site. Where a listing gave
  a musical key but no Camelot code, the code was converted by the standard wheel. Scratch
  and battle records carry a nominal tempo and no key.
- **`loose` pairs**: a few drills deliberately do not tempo- or key-match their records
  (scratch samples, spoken-word cuts, breaks at their own tempo, a level-setting drill where
  the decks never play together). Those refs are flagged and the cue says why.
- **Structure notes are phrase-level**, taken from the extended mix: how long the drum intro
  runs, where the bass or hook enters, where the breakdown sits, how long the outro is.
  Where a source did not document the arrangement, the note is prefixed `typical:` and
  describes the standard extended-mix layout for that style. No exact timestamps are
  claimed that a source did not state.
- **Pairs are compatible**: for two-deck drills the deck A and deck B records sit within a
  few percent of each other's BPM (or an exact 2× for the tempo-bridge drill) and are
  Camelot-compatible (same key, relative major/minor, or one step round the wheel). The
  content test enforces both.
- **The cue is drill-specific**: it tells you which phrase to start from and why that spot
  makes the drill's point (for a bass swap, both records need a dominant bassline at the
  swap; for a filter-out, the outgoing record needs a sustained element that reacts).

## Using them

Open a drill, read the Suggested tracks under the lesson, load them on the named decks in
rekordbox, and press "Use 125" (or whatever the record's tempo is) so the highway runs at
the record's BPM. "Copy tracklist" puts the list on the clipboard; Settings › Your data
exports every drill's tracks as CSV for building the crate.


## The pool

| id | Artist – Title (Mix) | BPM | Key | Genre | Year | Verified from |
|---|---|---|---|---|---|---|
| `jack-u-where-are-u-now` | Jack Ü feat. Justin Bieber – Where Are Ü Now (Original Mix) | 139 | 9A | bass | 2015 | [tunebat.com](https://tunebat.com/Info/Where-Are-Now-with-Justin-Bieber-Jack-Skrillex-Diplo-Justin-Bieber/66hayvUbTotekKU3H4ta1f) |
| `bob-james-nautilus` | Bob James – Nautilus (Album Version (One, 1974)) | 96 | 8A | breaks | 1974 | [tunebat.com](https://tunebat.com/Info/Nautilus-Bob-James/3q75LH3CaYL8g3CwUJ8yy3) |
| `fab-5-freddy-change-the-beat` | Fab 5 Freddy / Beside – Change The Beat (Original Mix (Celluloid 12", 1982)) | 97 | 7A | breaks | 1982 | [www.beatport.com](https://www.beatport.com/track/change-the-beat-original-mix/4765493) |
| `incredible-bongo-band-apache` | Incredible Bongo Band – Apache (Album Version (Bongo Rock)) | 118 | 9B | breaks | 1973 | [tunebat.com](https://tunebat.com/Info/Apache-Incredible-Bongo-Band/51ml2bJs9zDLv1PbzNQzPP) |
| `james-brown-funky-drummer` | James Brown – Funky Drummer (Original (Pt. 1 & 2 single edit / full version)) | 91 | 1B | breaks | 1970 | [tunebat.com](https://tunebat.com/Info/Funky-Drummer-James-Brown/0VbpqlboEkGQ7Pu6juJljZ) |
| `lyn-collins-think-about-it` | Lyn Collins – Think (About It) (Single Version) | 113 | 11B | breaks | 1972 | [tunebat.com](https://tunebat.com/Info/Think-About-It-Single-Version-Lyn-Collins/41VralobTkW7XgR5TebwNk) |
| `honey-drippers-impeach-the-president` | The Honey Drippers – Impeach The President (Original 1973 single (Alaga)) | 96 | 11B | breaks | 1973 | [tunebat.com](https://tunebat.com/Info/Impeach-the-President-The-Honey-Drippers/2KKyVgKvMf0oZPP4pQTETi) |
| `the-winstons-amen-brother` | The Winstons – Amen, Brother (Original 1969 single (B-side of 'Color Him Father')) | 130 | 3B | breaks | 1969 | [tunebat.com](https://tunebat.com/Info/Amen-Brother-The-Winstons/32Rf95ZT8gxisQMK6xAhba) |
| `disclosure-white-noise` | Disclosure feat. AlunaGeorge – White Noise (Original Mix) | 120 | 3A | deep-house | 2013 | [tunebat.com](https://tunebat.com/Info/White-Noise-Disclosure-AlunaGeorge/7mMaJKkvMKUB4KPtWjMQ8D) |
| `disclosure-latch` | Disclosure feat. Sam Smith – Latch (Original Mix) | 122 | 3B | deep-house | 2012 | [tunebat.com](https://tunebat.com/Info/Latch-Disclosure-Sam-Smith/1DunhgeZSEgWiIYbHqXl0c) |
| `gorgon-city-ready-for-your-love` | Gorgon City feat. MNEK – Ready For Your Love (Extended Mix) | 122 | 6A | deep-house | 2014 | [www.beatport.com](https://www.beatport.com/track/ready-for-your-love-extended-mix/15728514) |
| `route-94-my-love` | Route 94 feat. Jess Glynne – My Love (Original Mix) | 120 | 5A | deep-house | 2014 | [www.beatport.com](https://www.beatport.com/track/my-love-feat-jess-glynne-original-mix/10925513) |
| `andy-c-heartbeat-loud` | Andy C feat. Fiora – Heartbeat Loud (Original Mix) | 174 | 5B | drum-and-bass | 2014 | [tunebat.com](https://tunebat.com/Info/Heartbeat-Loud-Andy-C-Fiora/5PuJ00qKGWqbGeeWbt8WJb) |
| `chase-status-no-problem` | Chase & Status – No Problem (Original Mix) | 175 | 2B | drum-and-bass | 2013 | [tunebat.com](https://tunebat.com/Info/No-Problem-Chase-Status/5k3jdIh7BpJaV1DntDQoSD) |
| `netsky-rio` | Netsky feat. Digital Farm Animals – Rio (Original Mix) | 173 | 8B | drum-and-bass | 2015 | [tunebat.com](https://tunebat.com/Info/Rio-feat-Digital-Farm-Animals-Netsky-Digital-Farm-Animals/5IfSQQzGijWKd7dbkbqHuN) |
| `pendulum-tarantula` | Pendulum – Tarantula (Original Mix) | 174 | 9B | drum-and-bass | 2005 | [tunebat.com](https://tunebat.com/Info/Tarantula-Original-Mix-Pendulum-DJ-Fresh-pyda-Tenor-Fly/7ifq3etzDP60X1IRaFVngl) |
| `pendulum-hold-your-colour` | Pendulum – Hold Your Colour (Original Mix) | 174 | 6A | drum-and-bass | 2005 | [tunebat.com](https://tunebat.com/Info/Hold-Your-Colour-Pendulum/2pZXlPFnqc1uqEKFE7SjwQ) |
| `sub-focus-rock-it` | Sub Focus – Rock It (Original Mix) | 174 | 4A | drum-and-bass | 2009 | [tunebat.com](https://tunebat.com/Info/Rock-It-Sub-Focus/3VGCxo3ojR9PJQ81IqCE3p) |
| `sub-focus-dimension-desire` | Sub Focus & Dimension – Desire (Original Mix) | 174 | 1A | drum-and-bass | 2019 | [tunebat.com](https://tunebat.com/Info/Desire-Sub-Focus-Dimension/36fTP27G79me2HwuzGSz7a) |
| `wilkinson-afterglow` | Wilkinson feat. Becky Hill – Afterglow (Original Mix) | 174 | 9B | drum-and-bass | 2013 | [tunebat.com](https://tunebat.com/Info/Afterglow-Wilkinson-Becky-Hill/6LW3Z1GqbL78TIjfDyg4zp) |
| `flux-pavilion-i-cant-stop` | Flux Pavilion – I Can't Stop (Original Mix) | 140 | 5A | dubstep | 2010 | [tunebat.com](https://tunebat.com/Info/I-Can-t-Stop-Flux-Pavilion/5WSL7UTa38jMWoBzObD4BD) |
| `nero-promises-skrillex-nero-remix` | Nero – Promises (Skrillex & Nero Remix) | 140 | 9B | dubstep | 2011 | [tunebat.com](https://tunebat.com/Info/Promises-Skrillex-Nero-Remix-NERO/7569Hbv0FUS7vjkdGvdgeZ) |
| `rusko-woo-boost` | Rusko – Woo Boost (Original Mix) | 140 | 10A | dubstep | 2010 | [tunebat.com](https://tunebat.com/Info/Woo-Boost-Rusko/4lY0v0skiWm1UjRZTVXCnh) |
| `skrillex-scary-monsters-and-nice-sprites` | Skrillex – Scary Monsters and Nice Sprites (Original Mix) | 140 | 6B | dubstep | 2010 | [tunebat.com](https://tunebat.com/Info/Scary-Monsters-and-Nice-Sprites-Skrillex/4rwpZEcnalkuhPyGkEdhu0) |
| `avicii-levels` | Avicii – Levels (Original Version) | 126 | 12A | edm | 2011 | [tunebat.com](https://tunebat.com/Info/Levels-Avicii/6dfXwa0dI1sBm4CIePuOYM) |
| `hardwell-spaceman` | Hardwell – Spaceman (Extended Mix) | 128 | 2A | edm | 2012 | [tunebat.com](https://tunebat.com/Info/Spaceman-Hardwell/1Ca2ELRlvACAeI7xz9c9jR) |
| `martin-garrix-animals` | Martin Garrix – Animals (Extended Mix) | 128 | 3B | edm | 2013 | [tunebat.com](https://tunebat.com/Info/Animals-Martin-Garrix/1TWfkGrhF7ob0nwB2M6knb) |
| `swedish-house-mafia-dont-you-worry-child` | Swedish House Mafia feat. John Martin – Don't You Worry Child (Extended Mix) | 129 | 10B | edm | 2012 | [tunebat.com](https://tunebat.com/Info/Don-t-You-Worry-Child-Swedish-House-Mafia-John-Martin/043bfUkTydw0xJ5JjOT91w) |
| `zedd-clarity` | Zedd feat. Foxes – Clarity (Original Mix) | 128 | 4B | edm | 2012 | [tunebat.com](https://tunebat.com/Info/Clarity-Zedd-Foxes/60wwxj6Dd9NJlirf84wr2c) |
| `50-cent-in-da-club` | 50 Cent – In Da Club (Album Version (Get Rich or Die Tryin')) | 90 | 12A | hip-hop | 2003 | [tunebat.com](https://tunebat.com/Info/In-Da-Club-50-Cent/7iL6o9tox1zgHpKUfh9vuC) |
| `dr-dre-still-dre` | Dr. Dre feat. Snoop Dogg – Still D.R.E. (Album Version (2001)) | 93 | 1B | hip-hop | 1999 | [tunebat.com](https://tunebat.com/Info/Still-D-R-E-Dr-Dre-Snoop-Dogg/6ltPEsP4edATzvinHOzvk2) |
| `eric-b-rakim-paid-in-full` | Eric B. & Rakim – Paid In Full (Album Version (Paid In Full, 1987)) | 99 | 9B | hip-hop | 1987 | [tunebat.com](https://tunebat.com/Info/Paid-In-Full-Eric-B-Rakim-Marley-Marl/20s3FayrStM8GY0m4dRFsw) |
| `fatman-scoop-be-faithful` | Fatman Scoop feat. The Crooklyn Clan – Be Faithful (Original) | 101 | 9B | hip-hop | 1999 | [tunebat.com](https://tunebat.com/Info/Be-Faithful-Fatman-Scoop-The-Crooklyn-Clan/2jGUAB6hKlzK0pZmZpQ02g) |
| `house-of-pain-jump-around` | House Of Pain – Jump Around (Album Version) | 107 | 8A | hip-hop | 1992 | [tunebat.com](https://tunebat.com/Info/Jump-Around-House-Of-Pain/3TZwjdclvWt7iPJUnMpgcs) |
| `jay-z-dirt-off-your-shoulder` | JAY-Z – Dirt Off Your Shoulder (Album Version (The Black Album)) | 82 | 3B | hip-hop | 2003 | [tunebat.com](https://tunebat.com/Info/Dirt-Off-Your-Shoulder-JAY-Z/3IrkbGQCoEPAkzJ0Tkv8nm) |
| `kendrick-lamar-humble` | Kendrick Lamar – HUMBLE. (Album Version (DAMN.)) | 150 | 12A | hip-hop | 2017 | [tunebat.com](https://tunebat.com/Info/HUMBLE-Kendrick-Lamar/7KXjTSCq5nL1LoYtL7XAwS) |
| `nas-made-you-look` | Nas – Made You Look (Album Version (God's Son)) | 96 | 4A | hip-hop | 2002 | [tunebat.com](https://tunebat.com/Info/Made-You-Look-Nas/3qRPc4QpHGNwKFAzCdqwxA) |
| `notorious-big-hypnotize` | The Notorious B.I.G. – Hypnotize (2014 Remaster) | 93 | 11B | hip-hop | 1997 | [tunebat.com](https://tunebat.com/Info/Hypnotize-2014-Remaster-The-Notorious-B-I-G-/7KwZNVEaqikRSBSpyhXK2j) |
| `armand-van-helden-u-dont-know-me` | Armand Van Helden feat. Duane Harden – U Don't Know Me (Original Mix) | 130 | 7B | house | 1999 | [www.beatport.com](https://www.beatport.com/track/u-dont-know-me-feat-duane-harden-original-mix/5704) |
| `basement-jaxx-wheres-your-head-at` | Basement Jaxx – Where's Your Head At (Original Mix) | 128 | 8B | house | 2001 | [www.beatport.com](https://www.beatport.com/track/wheres-your-head-at/14182783) |
| `bicep-glue` | Bicep – Glue (Original Mix) | 130 | 9A | house | 2017 | [tunebat.com](https://tunebat.com/Info/Glue-Bicep/5ZYAufbhkzyhLxk0u2uLqj) |
| `camelphat-elderbrook-cola` | CamelPhat & Elderbrook – Cola (Original Mix) | 122 | 6B | house | 2017 | [www.beatport.com](https://www.beatport.com/track/cola/9382891) |
| `cece-peniston-finally` | CeCe Peniston – Finally (Original Mix) | 120 | 10A | house | 1991 | [tunebat.com](https://tunebat.com/Info/Finally-CeCe-Peniston/0uqvSVhGgQTIdj9G51vhvv) |
| `crystal-waters-gypsy-woman` | Crystal Waters – Gypsy Woman (She's Homeless) (Original / Basement Boys 1991 mix) | 119 | 8A | house | 1991 | [tunebat.com](https://tunebat.com/Info/Gypsy-Woman-Crystal-Waters/2jBQYMPjY0UspZAVyYPRUG) |
| `daft-punk-one-more-time` | Daft Punk – One More Time (Original Mix (album version)) | 123 | 10B | house | 2000 | [tunebat.com](https://tunebat.com/Info/One-More-Time-Daft-Punk/0DiWol3AO6WpXZgp0goxAV) |
| `daft-punk-around-the-world` | Daft Punk – Around The World (Original Mix (album version)) | 121 | 9B | house | 1997 | [tunebat.com](https://tunebat.com/Info/Around-the-World-Daft-Punk/1pKYYY0dkg23sQQXi0Q5zN) |
| `dennis-ferrer-hey-hey` | Dennis Ferrer – Hey Hey (Original Mix) | 126 | 10A | house | 2009 | [tunebat.com](https://tunebat.com/Info/Hey-Hey-Dennis-Ferrer/0R8dsqbzcoHoqUN5MLWyOi) |
| `duke-dumont-need-u-100` | Duke Dumont feat. A*M*E – Need U (100%) (Original Mix) | 124 | 5A | house | 2013 | [tunebat.com](https://tunebat.com/Info/Need-U-100-Duke-Dumont-A-M-E/3BCL5YNYmE6YMlZ8O1HCTV) |
| `inner-city-good-life` | Inner City – Good Life (Original 12" Mix) | 125 | 10A | house | 1988 | [tunebat.com](https://tunebat.com/Info/Good-Life-Original-12-Mix-Inner-City/2tI0P1fgY3WQFogkwKei3e) |
| `john-summit-where-you-are` | John Summit & Hayla – Where You Are (Original Mix) | 126 | 8A | house | 2023 | [tunebat.com](https://tunebat.com/Info/Where-You-Are-John-Summit-HAYLA/3pUz2qJe5nqZemi3hhIxMk) |
| `mk-17` | MK – 17 (Extended Mix) | 122 | 5A | house | 2017 | [tunebat.com](https://tunebat.com/Info/17-Extended-Mix-MK/7c6ETDTzGgl7gkNWvEn4FO) |
| `peggy-gou-it-goes-like-nanana` | Peggy Gou – (It Goes Like) Nanana (Original Mix) | 130 | 5A | house | 2023 | [www.beatport.com](https://www.beatport.com/track/it-goes-like-nanana/17839150) |
| `robin-s-show-me-love` | Robin S – Show Me Love (StoneBridge Club Mix (2020 Remaster)) | 123 | 8A | house | 1993 | [www.beatport.com](https://www.beatport.com/track/show-me-love-2020-remaster/17935393) |
| `stardust-music-sounds-better-with-you` | Stardust – Music Sounds Better With You (Original Mix (12" version)) | 124 | 7A | house | 1998 | [www.beatport.com](https://www.beatport.com/track/music-sounds-better-with-you/12247392) |
| `whitney-houston-its-not-right-thunderpuss` | Whitney Houston – It's Not Right But It's Okay (Thunderpuss Mix) | 130 | 4B | house | 1999 | [tunebat.com](https://tunebat.com/Info/It-s-Not-Right-But-It-s-Okay-Thunderpuss-Mix-Whitney-Houston/1oj8BhbCjzdd8oHNzdCw6L) |
| `lane-8-brightest-lights` | Lane 8 feat. Poliça – Brightest Lights (Original Mix) | 125 | 6B | melodic-house | 2020 | [www.beatport.com](https://www.beatport.com/track/brightest-lights-original-mix/13002646) |
| `solomun-home` | Solomun – Home (Club Mix) | 120 | 10B | melodic-house | 2020 | [www.beatport.com](https://www.beatport.com/track/home/14323099) |
| `kevin-de-vries-dance-with-me` | Kevin de Vries – Dance With Me (Original Mix) | 124 | 2B | melodic-techno | 2022 | [tunebat.com](https://tunebat.com/Info/Dance-With-Me-Kevin-de-Vries/0VbexUMmRVxsshn5PPqrfW) |
| `beyonce-crazy-in-love` | Beyoncé feat. JAY-Z – Crazy In Love (Album Version (Dangerously In Love)) | 99 | 6A | open-format | 2003 | [tunebat.com](https://tunebat.com/Info/Crazy-In-Love-Beyonc-JAY-Z/5IVuqXILoxVWvWEPm82Jxr) |
| `bruno-mars-24k-magic` | Bruno Mars – 24K Magic (Album Version) | 107 | 3B | open-format | 2016 | [tunebat.com](https://tunebat.com/Info/24K-Magic-Bruno-Mars/6b8Be6ljOzmkOmFslEb23P) |
| `dua-lipa-dont-start-now` | Dua Lipa – Don't Start Now (Album Version (Future Nostalgia)) | 124 | 10A | open-format | 2019 | [tunebat.com](https://tunebat.com/Info/Don-t-Start-Now-Dua-Lipa/3PfIrDoz19wz7qK7tYeu62) |
| `rihanna-dont-stop-the-music` | Rihanna – Don't Stop The Music (Album Version (Good Girl Gone Bad)) | 123 | 11A | open-format | 2007 | [tunebat.com](https://tunebat.com/Info/Don-t-Stop-The-Music-Rihanna/1Jo0Zg7XlrA6z0mFTZVdkn) |
| `boris-brejcha-gravity` | Boris Brejcha feat. Laura Korinth – Gravity (Original Mix) | 125 | 6B | progressive-house | 2019 | [www.beatport.com](https://www.beatport.com/track/gravity-feat-laura-korinth-original-mix/12255251) |
| `eric-prydz-pjanoo` | Eric Prydz – Pjanoo (Club Mix) | 126 | 6A | progressive-house | 2008 | [tunebat.com](https://tunebat.com/Info/Pjanoo-Club-Mix-Eric-Prydz/0noVd1VU93X8TEZMmpR3yN) |
| `eric-prydz-opus` | Eric Prydz – Opus (Original Mix) | 129 | 11B | progressive-house | 2015 | [www.beatport.com](https://www.beatport.com/track/opus-original-mix/6888199) |
| `dj-qbert-superseal-6` | DJ Q-Bert – Superseal 6 (Thud Rumble 12" (skipless battle record)) | 100 | — | scratch | 2021 | [www.discogs.com](https://www.discogs.com/release/20534938-DJ-Q-Bert-SuperSeal-6) |
| `dj-woody-scratch-sounds-no-2` | DJ Woody – Scratch Sounds No.2 (Reggae Clash) (Woodwurk 7" (skipless)) | 100 | — | scratch |  | [www.discogs.com](https://www.discogs.com/release/13800286-DJ-Woody-Scratch-Sounds-No2) |
| `skratchy-seal-super-seal-giant-robo-v1` | Skratchy Seal (DJ Q-Bert) – Super Seal Giant Robo V.1 (Head) (Thud Rumble / Dirt Style 7" (skipless)) | 100 | — | scratch | 2016 | [www.discogs.com](https://www.discogs.com/release/9594041-Skratchy-Seal-Super-Seal-Giant-Robo-V1-Head) |
| `thud-rumble-battle-breaks` | Thud Rumble (Dirtstyle) – Battle Breaks (7" reissue (BB001)) | 100 | — | scratch | 1992 | [www.thudrumble.com](https://www.thudrumble.com/products/bb001) |
| `chris-lake-turn-off-the-lights` | Chris Lake feat. Alexis Roberts – Turn Off The Lights (Extended Version) | 125 | 9A | tech-house | 2018 | [www.beatport.com](https://www.beatport.com/track/turn-off-the-lights-feat-alexis-roberts-extended-version/10309833) |
| `dom-dolla-take-it` | Dom Dolla – Take It (Extended Mix) | 123 | 5A | tech-house | 2018 | [www.beatport.com](https://www.beatport.com/track/take-it/10779666) |
| `fisher-losing-it` | Fisher – Losing It (Original Mix) | 125 | 10B | tech-house | 2018 | [tunebat.com](https://tunebat.com/Info/Losing-It-FISHER/6ho0GyrWZN3mhi9zVRW7xi) |
| `green-velvet-flash` | Green Velvet – Flash (Original Mix) | 128 | 11A | tech-house | 1995 | [tunebat.com](https://tunebat.com/Info/Flash-Green-Velvet/2L9BBx9601VBbqTdVNtvPC) |
| `hot-since-82-buggin` | Hot Since 82 feat. Jem Cooke – Buggin' (Original Mix) | 124 | 9A | tech-house | 2018 | [www.beatport.com](https://www.beatport.com/track/buggin-feat-jem-cooke-original-mix/10726480) |
| `patrick-topping-forget` | Patrick Topping – Forget (Original Mix) | 123 | 8B | tech-house | 2014 | [tunebat.com](https://tunebat.com/Info/Forget-Original-Mix-Patrick-Topping/3RXpeuxTgxqMzqGXVLRiCy) |
| `anna-hidden-beauties` | ANNA – Hidden Beauties (Original Mix) | 125 | 8B | techno | 2018 | [tunebat.com](https://tunebat.com/Info/Hidden-Beauties-ANNA/7IEEGzIQPidYujSduMuEBa) |
| `adam-beyer-bart-skils-your-mind` | Adam Beyer & Bart Skils – Your Mind (Original Mix) | 126 | 10A | techno | 2018 | [www.beatport.com](https://www.beatport.com/track/your-mind-original-mix/10670339) |
| `age-of-love-cdw-es-remix` | Age Of Love – The Age Of Love (Charlotte de Witte & Enrico Sangiuliano Remix) | 130 | 11B | techno | 2021 | [tunebat.com](https://tunebat.com/Info/The-Age-Of-Love-Charlotte-de-Witte-Enrico-Sangiuliano-Remix-Age-Of-Love-Charlotte-de-Witte-Enrico-Sangiuliano/6R84ZlQF7gGkPB6o3GLZXB) |
| `amelie-lens-higher` | Amelie Lens – Higher (Original Mix) | 136 | 1A | techno | 2019 | [tunebat.com](https://tunebat.com/Info/Higher-Amelie-Lens/2uQWi34NKPHpka4ldYrki4) |
| `charlotte-de-witte-doppler` | Charlotte de Witte – Doppler (Original Mix) | 135 | 3B | techno | 2019 | [tunebat.com](https://tunebat.com/Info/Doppler-Charlotte-de-Witte/0TtgKq96j4bpE5UQUDXrwH) |
| `charlotte-de-witte-sgadi-li-mi` | Charlotte de Witte – Sgadi Li Mi (Original Mix) | 135 | 11A | techno | 2020 | [tunebat.com](https://tunebat.com/Info/Sgadi-Li-Mi-Charlotte-de-Witte/5uQSAsOQyfMih2F9Zk8TkYH) |
| `enrico-sangiuliano-moon-rocks` | Enrico Sangiuliano – Moon Rocks (Original Mix) | 125 | 3B | techno | 2016 | [tunebat.com](https://tunebat.com/Info/Moon-Rocks-Enrico-Sangiuliano/4cTW1QdgCJiqE1Pvreb80L) |
| `enrico-sangiuliano-astral-projection` | Enrico Sangiuliano – Astral Projection (Original Mix) | 125 | 11A | techno | 2017 | [tunebat.com](https://tunebat.com/Info/Astral-Projection-Enrico-Sangiuliano/32nw9Qc5rYjsPWGLy14Yh5) |
| `jeff-mills-the-bells` | Jeff Mills – The Bells (Original Mix) | 138 | 9B | techno | 1997 | [tunebat.com](https://tunebat.com/Info/The-Bells-Jeff-Mills/0ISxyAhfop0MoMeAUw72RN) |
| `reinier-zonneveld-move-your-body-to-the-beat` | Reinier Zonneveld – Move Your Body To The Beat (Original Mix) | 133 | 4B | techno | 2018 | [tunebat.com](https://tunebat.com/Info/Move-Your-Body-To-The-Beat-Reinier-Zonneveld/53cLYZSnsw7BeJybRHPlox) |
| `underworld-born-slippy-nuxx` | Underworld – Born Slippy (Nuxx) (Nuxx) | 140 | 6B | techno | 1995 | [tunebat.com](https://tunebat.com/Info/Born-Slippy-Nuxx-Underworld/1zsDbmrf4ZkjW5hsSsaDjO) |
| `above-beyond-sun-and-moon` | Above & Beyond feat. Richard Bedford – Sun & Moon (Extended Club Mix) | 134 | 11A | trance | 2011 | [tunebat.com](https://tunebat.com/Info/Sun-Moon-Above-Beyond-Richard-Bedford/2CG1FmeprsyjgHIPNMYCf4) |
| `armin-van-buuren-communication` | Armin van Buuren – Communication (Original Mix) | 137 | 4B | trance | 1999 | [tunebat.com](https://tunebat.com/Info/Communication-Armin-van-Buuren/3Xoqg8LNJaGYvnpdsIYmOh) |
| `darude-sandstorm` | Darude – Sandstorm (Original Mix) | 136 | 10A | trance | 1999 | [tunebat.com](https://tunebat.com/Info/Sandstorm-Darude/3dxDj8pDPlIHCIrUPXuCeG) |
| `faithless-insomnia` | Faithless – Insomnia (Monster Mix) | 127 | 10A | trance | 1995 | [tunebat.com](https://tunebat.com/Info/Insomnia-Monster-Mix-Faithless-Rollo-Armstrong-Sister-Bliss-Goetz/2FH3BLTMlJlCH1Dmkua5DW) |
| `paul-van-dyk-for-an-angel` | Paul van Dyk – For An Angel (E-Werk Club Mix) | 138 | 8A | trance | 1998 | [tunebat.com](https://tunebat.com/Info/For-an-Angel-E-Werk-Club-Mix-Paul-van-Dyk/3RjDE80kRL7IWkp90nxkaS) |
| `tiesto-adagio-for-strings` | Tiësto – Adagio For Strings (Original Mix) | 141 | 3A | trance | 2005 | [www.audiokeychain.com](https://www.audiokeychain.com/track/cv/tisto-adagio-for-strings) |

## Assignments

| Drill | Deck | Track | Cue |
|---|---|---|---|
| CFX: return to detent | A | Bicep – Glue | Sustained pads react to the filter all the way in and out; sweep CFX A into low-pass over 4 bars and back to the centre click. If the return is off the detent the pads stay dull. |
| CFX: return to detent | A | Lane 8 feat. Poliça – Brightest Lights | The long pad outro gives you minutes of material for the high-pass half of the drill. |
| Cue on the downbeat | A | Inner City – Good Life | Drum-machine intro: cue on the first kick, set A1 to A3 on bars 5, 9 and 13, then recall them from bar 17 and listen for the kick doubling if you are late. |
| Cue on the downbeat | A | Duke Dumont feat. A*M*E – Need U (100%) | The chopped vocal fragments in the intro land on downbeats: a cue set 30 ms late doubles the fragment every time you recall it. |
| Cue on the downbeat | A | Stardust – Music Sounds Better With You | Cue on the first kick under the filtered guitar loop; the loop's phrase starts tell you whether each recall is on the one. |
| Fader blend over 16 bars | A | Boris Brejcha feat. Laura Korinth – Gravity | Gravity's stripped outro runs long enough for a 16-bar blend and then some. Start the drill two phrases before the end of A. |
| Fader blend over 16 bars | B | Lane 8 feat. Poliça – Brightest Lights | Cue B at its first kick: the pad-and-drum intro sits under Gravity for a full phrase without fighting it, which is the point of the 16-bar blend. |
| Fader blend over 8 bars | A | Chris Lake feat. Alexis Roberts – Turn Off The Lights | Deck A plays the extended version; start the drill on its percussive outro phrase. |
| Fader blend over 8 bars | B | Hot Since 82 feat. Jem Cooke – Buggin' | Cue B to its first kick (the 8:25 mix has a long drum intro). Play B on the one and ride its fader up over 8 bars; the intro is drums only, so nothing clashes while you learn the hand speed. |
| Fader control | A | Daft Punk – One More Time | Deck A: the filtered hook loops from the start. Keep it playing at full the whole drill. |
| Fader control | B | Solomun – Home | Cue B at the first kick of the 6:41 club mix. Every fader move in the drill happens against B's drum-and-bass intro, so an uneven ramp is audible as the bass swelling in steps. |
| Gain staging: hold the trim | A | The Winstons – Amen, Brother | A 1969 pressing is quiet next to a modern master: this is deck A, the track that needs trim up. Set it once and leave it. The two decks are not mixed together here, so tempo and key do not need to match. *(loose)* |
| Gain staging: hold the trim | B | Fisher – Losing It | A hot modern master: deck B needs trim down. Watch the channel meters, not the master, while you set both. *(loose)* |
| Headphone cue, then blend | A | Inner City – Good Life | A plays to the room from its first verse while you audition B. |
| Headphone cue, then blend | B | Dennis Ferrer – Hey Hey | Cue B at its first kick, press CUE B and audition the percussion intro in headphones for 8 bars, then play it on the one and blend; drop the headphone feed once the 'hey hey' hook is in the room. |
| Jog nudge: correct and settle | A | Enrico Sangiuliano – Moon Rocks | Two 16-bar phrases of pure percussion: nudge forward on bar 2, back on bar 4, and hear whether the groove settles back where it was. |
| Jog nudge: correct and settle | A | ANNA – Hidden Beauties | Hypnotic drum intro; the same drill against a slightly different swing. |
| Jog nudge forward | A | Adam Beyer & Bart Skils – Your Mind | Long dry drum intro: nudge the jog edge forward on the downbeat of bars 2, 4, 6 and 8 and listen to the hats bend and settle. Nothing melodic is in the way. |
| Jog nudge forward | A | Green Velvet – Flash | The acid line makes a pitch bend impossible to miss; use it once the drum-only version feels easy. |
| Phrase counting: 16 bars | A | Green Velvet – Flash | Loop-based tech-house with the spoken 'cameras ready' lines dropping in on 16-bar lines. Count from the first kick: A1 on each 16, A2 on the 8 in between, and check yourself against the vocal entries. |
| Phrase counting: 16 bars | A | Fisher – Losing It | Start at the first kick of the intro. The 'losing it' stab teases in on 8-bar lines and the drop lands on a 16-bar line, so the pads confirm your count. |
| Phrase counting: 16 bars | A | Adam Beyer & Bart Skils – Your Mind | Long percussive intro across two 16-bar phrases before the 'your mind' vocal. Count it in and hit A1 exactly where the vocal enters. |
| Phrase counting: 32 bars | A | Above & Beyond feat. Richard Bedford – Sun & Moon | Extended club mix: drum intro for two 16-bar phrases, chords on the third. A1 on the first kick and on the chord entry (bar 33); A2 on 17 and 49; A3 on every 8. |
| Phrase counting: 32 bars | A | Age Of Love – The Age Of Love | Drum intro for two 16-bar phrases, the arpeggio riff on the third. Your bar-33 A1 should coincide with the riff. |
| Phrase counting: 32 bars | A | Paul van Dyk – For An Angel | E-Werk Club Mix: bassline on the third 16-bar phrase, melody a phrase later. The 32-bar count puts A1 on each of those entries. |
| Phrase counting | A | Faithless – Insomnia | The Monster Mix has one of the longest DJ intros in the canon. Start on the first kick and count 8-bar phrases; the vocal, the breakdown and the riff all arrive on 16- or 32-bar lines, so every one of your A1 presses should land where something changes. |
| Phrase counting | A | Eric Prydz – Opus | Nine minutes of one slow crescendo. Elements are added on phrase boundaries, never mid-phrase, so if your count drifts you hear it immediately. Practise from the first kick through the peak. |
| Phrase counting | A | Daft Punk – Around The World | Elements come in and out in 16-bar blocks over a bassline that never stops. Count from the first kick; when the vocoder hook arrives you should be on a phrase downbeat. |
| SYNC, then still nudge | A | Fisher – Losing It | Master deck: A on its drum intro sets the tempo. |
| SYNC, then still nudge | B | Dennis Ferrer – Hey Hey | Press SYNC on B on A's downbeat, then nudge forward on bar 2 and back on bar 6 while both intros play; the two kicks tell you whether the beatgrid is right. |
| Tempo creep | A | Boris Brejcha feat. Laura Korinth – Gravity | A: a long, sparse track where a 2% tempo change is not obvious to the room, only to the phase. |
| Tempo creep | B | Lane 8 feat. Poliça – Brightest Lights | B: creep B's tempo up 2% over 16 bars against A, hold, then bring A up to meet it. With both tracks so sparse you hear the phase drift, not a pitch change. |
| Tempo-fader ride | A | Adam Beyer & Bart Skils – Your Mind | Ride the tempo fader against the dry intro: push up two beats, straight back, and the hats tell you whether you returned to the exact value. |
| Tempo-fader ride | A | Green Velvet – Flash | Ride against the acid bassline: the pitch of the 303 exposes any return that misses the starting value. |
| Tempo matching ramp | A | Eric Prydz – Opus | A stays on the master tempo through its slow build. |
| Tempo matching ramp | B | Age Of Love – The Age Of Love | Move TEMPO B in the small, held steps the drill asks for while B's drum intro runs; a straight-line arrival with no overshoot is the whole exercise. |
| Backspin out with Pad FX | A | Duke Dumont feat. A*M*E – Need U (100%) | A on the hook: press Pad FX Backspin on beat 4 of bar 12, kill the fader on the one of 13. |
| Backspin out with Pad FX | B | MK – 17 | Cue B on the first chopped vocal hit of the extended mix and start it on the one of bar 13 with the fader coming up. |
| Brake out with Pad FX | A | The Notorious B.I.G. – Hypnotize | A on the sung hook: Braker on beat 4 of bar 12 so the last hook line slows to a stop. |
| Brake out with Pad FX | B | The Honey Drippers – Impeach The President | Cue B on the break that opens the record and play it on the one of 13; a bare break is the perfect first sound after the brake. |
| Camelot energy boost | A | Hardwell – Spaceman | A on the drum-only section after its breakdown. |
| Camelot energy boost | B | Kevin de Vries – Dance With Me | Cue B at its drum intro, mix it in over 8 bars, then in the last bar before bar 13 KEY SHIFT B two semitones up: the lead motif makes the lift obvious. |
| CH SELECT the outgoing deck | A | John Summit & Hayla – Where You Are | First echo out on A's drop: A is leaving, so CH SELECT 1 in the bar before the phrase end. |
| CH SELECT the outgoing deck | B | Chris Lake feat. Alexis Roberts – Turn Off The Lights | B comes in under the tail; before the second echo out, CH SELECT 2 because now B is leaving. |
| Classic bass-swap transition | A | Robin S – Show Me Love | The M1 organ bass is the whole track. A plays from the verse; at bar 17 its low knob comes down over 4 bars and the room hears exactly one bassline the whole time. |
| Classic bass-swap transition | B | Patrick Topping – Forget | Cue B at its first kick with the low knob off. Bring it in on hi and mid; its bassline hook arrives on a phrase line, so time the swap so B's low is at centre when the hook lands. |
| Classic bass-swap transition | B | Stardust – Music Sounds Better With You | Alternative B: the filtered loop rides on a bass that never stops, so any moment both lows are up is audible mud. Good for hearing why the swap has to be clean. |
| Echo out | A | Basement Jaxx – Where's Your Head At | A on the hook: the shouted riff is what the echo tail is made of. Press ON on the last beat of bar 16 and pull the fader inside half a beat. |
| Echo out | B | Patrick Topping – Forget | Cue B at its first kick and play it on the one of bar 17, under the echo tail. |
| Fader blend over 32 bars | A | Charlotte de Witte – Sgadi Li Mi | A on its long drum outro. |
| Fader blend over 32 bars | B | Above & Beyond feat. Richard Bedford – Sun & Moon | Cue B at the first kick of the Extended Club Mix with its low off. The fader rises across two full 16-bar phrases; the chords arrive on the third phrase, right where the bass swaps at bar 33. |
| Fader chops on sixteenths | A | Nas – Made You Look | Sixteenth chops on the Apache-break intro at 96; work up from 8ths. |
| Fader chops on sixteenths | A | Eric B. & Rakim – Paid In Full | The sparse loop under the verse leaves space for every click to be heard. |
| Fader chops on eighths | A | Nas – Made You Look | Chop A's fader over the drum-only intro (the Apache break): 32 moves, one per eighth, with nothing melodic to hide sloppy timing. |
| Fader chops on eighths | A | The Honey Drippers – Impeach The President | The break opens the record: the same chops over a raw break. |
| Filter-out transition | A | Lane 8 feat. Poliça – Brightest Lights | A on its pad-led section: the pads thin beautifully under a high-pass, leaving air and hats. |
| Filter-out transition | B | Boris Brejcha feat. Laura Korinth – Gravity | Cue B at the first kick of its long minimal intro and bring it in normally, then take A's filter high-pass over 16 bars before pulling A's fader. |
| Hard cut on the one | A | Age Of Love – The Age Of Love | A on the arpeggio riff section. |
| Hard cut on the one | B | Swedish House Mafia feat. John Martin – Don't You Worry Child | Cue B on the first beat of its drop, not its intro. Both faders swap inside a quarter beat on bar 33; the cut only works because both tracks are on a phrase boundary. |
| Hard cut on the one | B | Green Velvet – Flash | Alternative B: cue on the first beat of the acid bassline entry. |
| Harmonic key shift | A | Eric Prydz – Pjanoo | A on the piano riff: 6A. Melodic content makes the semitone shift on B audible. |
| Harmonic key shift | B | Lane 8 feat. Poliça – Brightest Lights | B is 6B, one Camelot step away: load it a semitone down in rekordbox first, then press the KEY SHIFT pad that raises it back before playing on the one. |
| Long EQ morph | A | Tiësto – Adagio For Strings | A on its long build: the string theme keeps evolving, so any single move you make is masked and only the sum is heard. |
| Long EQ morph | B | Charlotte de Witte – Doppler | Cue B at its percussion intro and take 64 bars to arrive: fader, mids, then the bass swap across bars 33 to 37 where B's riser begins. |
| Loop the outro | A | Age Of Love – The Age Of Love | A near its end: the extended drum outro loops cleanly. IN on bar 9, OUT on bar 13, exit with RELOOP/EXIT on bar 21. |
| Loop the outro | B | Charlotte de Witte – Sgadi Li Mi | Cue B at its kick intro and bring it in on bar 17 over the loop. |
| Low-pass mix out | A | CamelPhat & Elderbrook – Cola | A on the 'coca-cola' hook: low-pass it over 8 bars until only the thud is left, then cut. |
| Low-pass mix out | B | Gorgon City feat. MNEK – Ready For Your Love | Cue B at the first kick of the extended mix; it comes in over 8 bars while A is still full. |
| Low-pass out, high-pass in | A | Solomun – Home | A: close CFX A into low-pass over bars 9 to 17 while B opens. |
| Low-pass out, high-pass in | B | Adam Beyer & Bart Skils – Your Mind | Cue B at its groove intro with CFX held in high-pass; bring the fader up over 8 bars so only its top end is in, then open the filter as A's closes. |
| One-bar bass swap | A | Fisher – Losing It | A on its drop: the rolling bassline is dominant, so a slow swap is mud. |
| One-bar bass swap | B | Dennis Ferrer – Hey Hey | Cue B at its first kick with its low off. Bring it in over 8 bars; on bar 9 swap the lows inside one bar so B's organ bass takes over cleanly. |
| Outro to intro at full volume | A | Hot Since 82 feat. Jem Cooke – Buggin' | A is in its long stripped outro; both channels sit at full for 22 bars because the outro has no bass to fight. |
| Outro to intro at full volume | B | Chris Lake feat. Alexis Roberts – Turn Off The Lights | Cue B at the first kick of the extended version with the low cut, fader straight to full. Swap the bass at bar 17 when B's vocal enters and take A out only over bars 25 to 33. |
| Phrase-matched mix in | A | Inner City – Good Life | A on its first verse; you press PLAY B exactly on A's bar 9. |
| Phrase-matched mix in | B | Dennis Ferrer – Hey Hey | Cue B exactly on its first kick with its bass cut. PLAY on A's bar 9, fader up over 8, swap the bass at 17; the 'hey hey' hook then arrives on A's phrase line. |
| Reverb wash out | A | Daft Punk – One More Time | A on the hook: bring LEVEL/DEPTH up over the last bar, press ON on the last beat so the final snare is what gets washed, cut on the one. |
| Reverb wash out | B | Fisher – Losing It | Cue B on the first beat of its drop and start it on the same one you cut A. |
| Staggered EQ blend | A | Enrico Sangiuliano – Astral Projection | A on its groove; highs leave first, then mids, then the bass swaps last at bar 17. |
| Staggered EQ blend | B | Green Velvet – Flash | Cue B at its dry drum-machine intro. Its highs arrive first, mids over bars 9 to 13, and the acid bassline takes over at 17. |
| Top-down EQ handover | A | ANNA – Hidden Beauties | A on its pad-and-bass groove; each band leaves in turn as B's arrives. |
| Top-down EQ handover | B | Patrick Topping – Forget | Cue B at its drum intro with all three bands cut, fader up in 4 bars, then hand over one band every 4 bars, highs first; its bassline hook lands as the lows arrive. |
| Crossfader drop mix | A | 50 Cent – In Da Club | A on the riff intro; crossfader hard left. Hip-hop drop mixes cut between hooks, so key is not matched here. *(loose)* |
| Crossfader drop mix | B | Dr. Dre feat. Snoop Dogg – Still D.R.E. | Cue B on the first piano stab, silent on the right. Snap to B on bar 9, back to A on bar 17: a switch, no fade. *(loose)* |
| Acapella over an instrumental | B | CeCe Peniston – Finally | The 'Finally' acapella (12-inch pressings) cued to its first word; play it on the one of bar 9 over an instrumental in 10A or 10B. |
| Acapella over an instrumental | A | Solomun – Home | A plays the club mix's instrumental section: 10B, 120 BPM, a key and tempo match for the acapella. |
| Acapella over an instrumental | B | Crystal Waters – Gypsy Woman (She's Homeless) | Alternative acapella: the 'la da dee' line, cued to its first syllable; pair it with an 8A or 8B instrumental, not with Home. *(loose)* |
| Beat jump navigation | B | Adam Beyer & Bart Skils – Your Mind | B's 32-beat beatless intro is what BEAT JUMP 32 is for; jump 8 and 4 to correct the other two situations while A plays. |
| Beat jump navigation | A | Fisher – Losing It | A plays through from its intro; every jump on B is judged against A's phrase count. |
| Beat roll build | A | Martin Garrix – Animals | A on the four bars before the drop: retrigger a 1/4-beat roll every two beats through bars 13 to 16, then hot cue A1 on the drop's first beat. |
| Beat roll build | A | Hardwell – Spaceman | Same drill on the big-room drop; cue A1 on the drop. |
| Breakdown swap | A | Armin van Buuren – Communication | A goes into its long melodic breakdown on bar 1 of the drill. |
| Breakdown swap | B | Charlotte de Witte – Doppler | Cue B on the first beat of its drop with the low cut, bring the beat in under A's breakdown, and on bar 17, where A's breakdown would resolve, cut A and let B's bass up: B's drop lands where A's was going to. |
| Censor with reverse | A | Fatman Scoop feat. The Crooklyn Clan – Be Faithful | Hold Beat Jump pad 8 on beat 4 of bars 1 and 3 to reverse the shouted word under it; the shouts land on downbeats, so the target is easy to find. |
| Censor with reverse | A | 50 Cent – In Da Club | The hook's opening line; reverse the last word of the bar. |
| Cue-point stutter | A | Fisher – Losing It | Hot cue 1 on the first kick; hit it every beat for 4 bars so the intro stutters, against deck B playing the same tempo. |
| Cue-point stutter | A | Dom Dolla – Take It | The 'take it' stab as the cue point: a stutter you can hear. |
| Drum and bass double drop | A | Pendulum – Tarantula | A on its first drop (the third 16-bar phrase). B enters on the second drop section. |
| Drum and bass double drop | B | Wilkinson feat. Becky Hill – Afterglow | Both 9B: cue B so its drop lands 32 bars after B's fader comes up; on bar 33 the two drops hit and B's bass takes over in half a bar. |
| Drum and bass double drop | B | Netsky feat. Digital Farm Animals – Rio | Alternative B in 8B: cue on the first beat of its drop. |
| Drop swap | A | Martin Garrix – Animals | A is in its build: the snare roll and riser before the drop. |
| Drop swap | B | Zedd feat. Foxes – Clarity | Hot cue B1 on the first beat of Clarity's drop; on bar 17 press B1 and snap the crossfader in one motion. |
| Filter and echo combo release | A | Basement Jaxx – Where's Your Head At | Sweep A's Smart CFX right over bars 13 to 16 of the hook, echo on the last half beat, snap the filter back and cut. |
| Filter and echo combo release | B | Patrick Topping – Forget | Cue B at its drum intro and play it on the beat after the cut. |
| Fisher-style pre-drop entry | A | Fisher – Losing It | A on its last drop; the drill starts on the first beat of that phrase. |
| Fisher-style pre-drop entry | B | Dennis Ferrer – Hey Hey | Cue B so its hook entry lands on bar 33: B starts with the low cut on bar 17, rises over 8 bars, the one-bar breath at bar 26, and the 'hey hey' hook drops two bars after A is killed. |
| Flanger build | A | Martin Garrix – Animals | Flanger ON on the one of bar 13 of the build, sweep depth to 90% over four bars, OFF exactly on the drop. |
| Flanger build | A | Swedish House Mafia feat. John Martin – Don't You Worry Child | The same on the riser into the drop. |
| Hot-cue drumming | A | Fisher – Losing It | Kick, clap, hat and the 'losing it' stab from the intro. Every hit is isolated in the first phrase, so a late pad is audible. |
| Hot-cue drumming | A | Duke Dumont feat. A*M*E – Need U (100%) | Kick, clap, hat and a chopped vocal fragment from the intro. |
| Hot-cue drumming | A | Dom Dolla – Take It | Kick, clap, hat and the 'take it' stab. |
| Instant doubles, half-beat offset | A | Fisher – Losing It | Instant doubles of Losing It: hot cue 1 on the first kick of both decks, press B1 half a beat after A1 for the flam. |
| Instant doubles, half-beat offset | B | Fisher – Losing It | The same file on B, hot cue 1 on the same first kick. |
| Loop build and release | A | Martin Garrix – Animals | On the build: 4-beat loop at bar 9, halve to 2, 1, half, exit exactly on the drop at bar 17. |
| Loop build and release | A | Faithless – Insomnia | The bars before the riff returns after the breakdown: loop-halve into the riff entry. |
| Loop roll halving build | A | Hardwell – Spaceman | IN/4BEAT on each downbeat of bars 13 to 16 of the build, halving each time, RELOOP/EXIT on the drop. |
| Loop roll halving build | A | Darude – Sandstorm | The snare-roll build before the second drop. |
| Pad FX stabs | A | Dennis Ferrer – Hey Hey | Echo, flanger, reverb and roll pressed and released on the vocal-and-organ hook; each release has to be as clean as the press. |
| Pad FX stabs | A | Basement Jaxx – Where's Your Head At | The shouted hook makes every stab and its release obvious. |
| Quick mix: 8-bar dropmix | A | Dr. Dre feat. Snoop Dogg – Still D.R.E. | A1 on the first piano stab. Quick-mix cuts between hooks; key is not matched. *(loose)* |
| Quick mix: 8-bar dropmix | B | Nas – Made You Look | B1 on the 'they shootin'' hit, B2 on the hook; every 8 bars press the next cue and snap the crossfader on the one. *(loose)* |
| Sampler drops and risers | A | Martin Garrix – Animals | Fire the sampler riser on bar 13 of the build so it peaks on the drop, hit on 17 and 18, riser at 29 and the tag on 33. |
| Sampler drops and risers | A | Hardwell – Spaceman | The same over the big-room build. |
| Smart CFX sweep | A | Avicii – Levels | Sweep Smart CFX right over bars 9 to 16 of the piano riff, landing back on the detent on the one of 17. |
| Smart CFX sweep | A | Fisher – Losing It | The same over the drop; the filter-plus-echo combo on the bassline. |
| Smart Fader transition | A | Rihanna – Don't Stop The Music | A at 123: play B on bar 9 and move the crossfader evenly across bars 9 to 17. |
| Smart Fader transition | B | CeCe Peniston – Finally | B at 120 in a compatible key; Smart Fader ramps B's tempo toward A and adds echo as you cross. |
| Sustained beatmatch by ear | A | Inner City – Good Life | A on its drum-machine intro, sync off. |
| Sustained beatmatch by ear | B | Adam Beyer & Bart Skils – Your Mind | Headphones on B, match its dry drum intro to A over 4 bars, nudge on bar 5 and hold for 32. |
| Tempo bridge: half time to double | A | Dua Lipa – Don't Start Now | A at 124 echoes out on the last beat of bar 16. |
| Tempo bridge: half time to double | B | Pendulum – Tarantula | B is 174 heard at half time (87): cue it so its half-time feel lands on the one of bar 17; the double-time kick arrives at the drop. *(loose)* |
| Transformer on the crossfader | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh, fresh' sound on A, crossfader hard right; 64 clicks across 4 bars. Scratch material, so key is not matched. *(loose)* |
| Transformer on the crossfader | A | DJ Q-Bert – Superseal 6 | Any skipless locked groove on the 100 side; the transformer pattern over a beat on B. |
| Transformer on the crossfader | B | Dr. Dre feat. Snoop Dogg – Still D.R.E. | B supplies the beat under the transformer clicks. |
| Baby scratch | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| Baby scratch | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| Baby scratch | B | James Brown – Funky Drummer | B: the Funky Drummer break (at 5:34 on the full version) as the beat to scratch over; eight strokes a bar, each the same length. |
| Beat juggle: extend the one | A | The Honey Drippers – Impeach The President | The break opens the record: hot cue 1 on its first beat on both decks, cut between them every two beats so the first half repeats forever. |
| Beat juggle: extend the one | B | The Honey Drippers – Impeach The President | The same file on B, hot cue 1 on the break's first beat. |
| Beat juggle: extend the one | A | The Winstons – Amen, Brother | Alternative: the four-bar Amen break at 1:26, at its own tempo; juggle its first two beats. *(loose)* |
| Chirp scratch | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| Chirp scratch | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| Chirp scratch | B | Dr. Dre feat. Snoop Dogg – Still D.R.E. | B: the Still D.R.E. beat; the fader opens at the start of each stroke and closes as it ends. |
| Crab scratch | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| Crab scratch | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| Crab scratch | B | James Brown – Funky Drummer | B: a one-beat forward stroke with four fader clicks across it, once a bar. |
| Crossfader cut pattern | A | Fab 5 Freddy / Beside – Change The Beat | A on the 'ahhh' sample; crossfader hard left to right on every beat with the curve set sharp. *(loose)* |
| Crossfader cut pattern | B | Eric B. & Rakim – Paid In Full | B: the sparse verse loop as the beat to cut against. |
| Cue juggling across decks | A | CeCe Peniston – Finally | A1 on the first piano chord of the vamp, A2 on the 'finally' hook. |
| Cue juggling across decks | B | Dua Lipa – Don't Start Now | B1 on a string stab, B2 on the first bass note; A on the one, B on the two, and so on. |
| Cue-point scratch | A | Nas – Made You Look | Hot cue A1 on the 'they shootin'' stab: press on the beat, then chop the fader twice in the half beat after. |
| Cue-point scratch | A | 50 Cent – In Da Club | A1 on 'go shorty'; the same press-and-chop. |
| Double drop | A | Martin Garrix – Animals | A on its first drop. Both tracks at 128. |
| Double drop | B | Zedd feat. Foxes – Clarity | Cue B on the first beat of its drop so it lands on bar 17 of A's drop; fader slams up in the quarter beat before. 3B and 4B are one step apart, so the drops sit together. |
| Drag scratch | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| Drag scratch | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| Drag scratch | B | The Honey Drippers – Impeach The President | B: the Impeach The President break; one long forward stroke across two beats, one back. |
| One-click flare | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| One-click flare | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| One-click flare | B | The Honey Drippers – Impeach The President | B: the break at 96; one click in the middle of each stroke. |
| Hot-cue drumming: sixteenth fills | A | Duke Dumont feat. A*M*E – Need U (100%) | Kick, snare and hat from the intro; the sixteenth fill on the hat cue. |
| Hot-cue drumming: sixteenth fills | A | Fisher – Losing It | Kick, clap and hat from the intro at 125. |
| Hot-cue drumming: off-beat hats | A | Green Velvet – Flash | Kick, snare and closed hat from the dry drum-machine intro; hat on every off-beat eighth. |
| Hot-cue drumming: off-beat hats | A | Adam Beyer & Bart Skils – Your Mind | The same from its percussion intro. |
| Manual beatmatch nudge | A | Inner City – Good Life | A on its drum-machine intro, sync off; it sets the tempo. |
| Manual beatmatch nudge | B | Adam Beyer & Bart Skils – Your Mind | Push B's tempo fader up a small even amount over 4 bars against A's kick, hold, bring it back. |
| Scribble scratch | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| Scribble scratch | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| Scribble scratch | B | James Brown – Funky Drummer | B: the Funky Drummer break; sixteen tiny strokes in two beats, then rest. |
| Stab scratch | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| Stab scratch | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| Stab scratch | B | Dr. Dre feat. Snoop Dogg – Still D.R.E. | B: the beat; forward strokes on each beat, only the forward half heard. |
| Tear scratch | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| Tear scratch | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| Tear scratch | B | The Honey Drippers – Impeach The President | B: two forward halves with a stop between, one continuous stroke back. |
| Tone play melody | A | Dr. Dre feat. Snoop Dogg – Still D.R.E. | Hot cue 1 on a single piano stab, KEY SHIFT mode on the pads, and play the two-bar melody from that one stab. Any tempo works; the note is what matters. *(loose)* |
| Tone play melody | A | Beyoncé feat. JAY-Z – Crazy In Love | The Chi-Lites horn stab as the note. *(loose)* |
| Transformer scratch | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| Transformer scratch | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| Transformer scratch | B | James Brown – Funky Drummer | B: two-beat drags with the crossfader clicking on every sixteenth. |
| Two-bar EQ swap | A | Green Velvet – Flash | A on the acid bassline section, where the low band is everything. |
| Two-bar EQ swap | B | Adam Beyer & Bart Skils – Your Mind | Cue B at its groove intro with all EQ cut. Hi, mid, low of A leave in sequence over 8 beats while B's bass arrives; peak-time speed. |
| Word play | A | 50 Cent – In Da Club | A: the hook line ending on beat 4 of bar 4. Spoken words, so key does not matter; match the tempo by ear. *(loose)* |
| Word play | B | Eric B. & Rakim – Paid In Full | B: hot cue on 'pump up the volume' (or another downbeat word); snap to B on that beat and back on beat 4 of bar 8. *(loose)* |
| A-Trak: notated scratch combo | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| A-Trak: notated scratch combo | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| A-Trak: notated scratch combo | B | Dr. Dre feat. Snoop Dogg – Still D.R.E. | B: the beat for the two-bar notated line: chirps, a tear, one-click flares, a scribble. |
| Carl Cox: rolls and cue builds | A | Age Of Love – The Age Of Love | A on the arpeggio riff: from bar 13 its CUE button stutters on beats then eighths, PLAY on 17 so it runs on. |
| Carl Cox: rolls and cue builds | B | Charlotte de Witte – Sgadi Li Mi | Cue B at its kick intro with the low cut; the bass swaps to B in bar 17 as A's stutter resolves. |
| Carl Cox: three-deck acapella layer | A | Age Of Love – The Age Of Love | A and B run as in the two-deck drill: A on the arpeggio riff. |
| Carl Cox: three-deck acapella layer | B | Charlotte de Witte – Sgadi Li Mi | B from its kick intro, bass swapped to B at bar 17. |
| Carl Cox: three-deck acapella layer | B | CeCe Peniston – Finally | The acapella on the third deck, pitched to 130 and key-shifted in rekordbox to fit, started on the one of bar 17 over both. *(loose)* |
| Charlotte de Witte: loop out and high-cut | A | Charlotte de Witte – Doppler | An 8-bar loop on A's peak section from bar 9; exit on 33 and reverb A out. |
| Charlotte de Witte: loop out and high-cut | B | Reinier Zonneveld – Move Your Body To The Beat | Cue B at its kick-and-acid intro with highs and lows cut; fader up over 4 bars from 17, highs back over 25 to 29, bass swap 29 to 31. |
| DJ Craze: forearm slow-motion scratch | A | Fab 5 Freddy / Beside – Change The Beat | The 'ahhh' and 'fresh' vocoder samples: cue on the 'ahhh'. Scratch material, so tempo and key are not matched. *(loose)* |
| DJ Craze: forearm slow-motion scratch | A | DJ Q-Bert – Superseal 6 | Skipless locked grooves so the sample never has to be re-cued. |
| DJ Craze: forearm slow-motion scratch | B | James Brown – Funky Drummer | B: the break; the two-beat forearm drag over bars 1 and 3. |
| DJ Craze: hot key, scratch, deck switch | A | Nas – Made You Look | A1 on the 'they shootin'' hit, A2 on the kick; scratch each with a baby stroke. Scratch combo, so key is not matched. *(loose)* |
| DJ Craze: hot key, scratch, deck switch | B | The Honey Drippers – Impeach The President | B1 and B2 on the break's first snare and kick; snap the crossfader across and repeat on jog B. *(loose)* |
| Grandmaster Flash: quick-mix backspin extension | A | The Honey Drippers – Impeach The President | The break opens the record, so hot cue 1 is at the very top on both decks; cut to B after two bars and spin A back while B plays. |
| Grandmaster Flash: quick-mix backspin extension | B | The Honey Drippers – Impeach The President | The same file on B, hot cue 1 on the break's first beat. |
| Grandmaster Flash: quick-mix backspin extension | A | Incredible Bongo Band – Apache | Alternative: Apache's long percussion break at its own tempo, the record Kool Herc did this with. *(loose)* |
| James Hype: cue drumming and loops | A | Fisher – Losing It | A1 kick, A2 clap, A3 hat from the intro: the drum pattern for bars 1 to 4. |
| James Hype: cue drumming and loops | B | Dennis Ferrer – Hey Hey | B's kick and snare cues take over for bars 5 to 8; the halving loop on B from bar 13, exit on 17. |
| Skrillex: power-block mixing | A | Nero – Promises | A1 on the first drop; the block opens here in 9B. |
| Skrillex: power-block mixing | B | Jack Ü feat. Justin Bieber – Where Are Ü Now | B1 on its drop for bar 17: 9A, one step round the wheel. |
| Skrillex: power-block mixing | A | Rusko – Woo Boost | A2 on its wobble drop for bar 33: 10A, still one step round. |
| Skrillex: power-block mixing | B | Skrillex – Scary Monsters and Nice Sprites | B2 on its drop for bar 49. Four tracks, four drops, nothing dwells longer than 27 seconds; the last cut is an energy jump, so key-shift it in rekordbox or accept the clash as the original sets do. *(loose)* |
