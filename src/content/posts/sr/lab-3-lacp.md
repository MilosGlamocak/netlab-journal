---
pubDatetime: 2026-11-07T00:00:00Z
title: "Lab 3: Link Aggregation Control Protocol (LACP)"
featured: true
draft: false
tags:
  - containerlab
  - nokia-srlinux
  - networking
  - lag
  - lacp
  - ccna
description: "Treći lab: jedan trunk link iz ROAS topologije zamijenjen sa dva fizička linka u LAG-u, sa dinamičkim LACP-om između dva Nokia SR Linux uređaja u containerlab-u."
---

Plan ovog lab-a je da naučimo kako se implementira Link Aggregation Group (LAG) i Link Aggregation Control Protocol (LACP) u Nokia SR Linux okruženju. Koristiću ROAS topologiju iz [prošlog lab-a](/sr/posts/lab-2-roas/), a jedan trunk link između switch-a i router-a zamijeniću sa dva fizička linka koja rade kao jedan logički.

## Sadržaj

## Faza 1 – Plan i topologija

### Šta su LAG i LACP

Za neupućene, LAG (ili EtherChannel, kako se zove u Cisco okruženju) kao mrežni koncept služi za dvije primarne svrhe: agregaciju bandwidth-a neke veze i redundansu te veze. LAG predstavlja jedan logički interfejs sastavljen od određenog broja fizičkih interfejsa, koji time čine jednu logičku cjelinu. Ovaj koncept radi na L2 – ethernet nivou OSI modela.

LACP, sa druge strane, je protokol preko kojeg, između ostalog, dva uređaja međusobno pregovaraju koji fizički linkovi ulaze u LAG. Sam LAG se i dalje kreira ručno na obe strane, ali LACP nam automatizuje i olakšava odluku oko toga koji članovi su aktivni, kao i neka druga podešavanja performansi LAG-a, razmjenjujući LACPDU-ove između uređaja.

Umjesto statičkog LAG-a, u ovom lab-u konfigurišem LACP jer se češće sreće u praksi.

Za nešto detaljnija objašnjenja LAG-a i LACP-a preporučujem [JeremysITLab](https://www.youtube.com/watch?v=xuo69Joy_Nc), a Nokia dokumentaciju koju sam pratio možete da nađete [ovde](https://documentation.nokia.com/srlinux/24-10/books/interfaces/lag.html).

### Topologija

Danas koristim već postojeću topologiju iz [lab-a broj 2](/sr/posts/lab-2-roas/). Ukratko, mreža se sastoji od 3 host uređaja, jednog switch-a i jednog router-a, podijeljena je u 3 VLAN-a, a rutiranje se vrši preko Router-on-a-Stick pristupa.

Za potrebe ovog lab-a, veza između router-a i switch-a biće konvertovana u LAG. Umjesto jednog fizičkog linka imaćemo dva, na portovima `ethernet-1/1` i `ethernet-1/5`, a trunking će se izvršavati na logičkom `lag1` interfejsu.

<figure>
  <img src="/roas-lag.drawio.svg" alt="Topologija lab-a ROAS over LAG: tri Alpine klijenta (HOST10, HOST20, HOST30) u VLAN-ovima 10, 20 i 30 povezani access linkovima na SW1, koji je sa ruterom R1 povezan preko dva fizička linka (e1/1 i e1/5) objedinjena u lag1 (LACP) 802.1Q trunk" class="w-full h-auto" />
  <figcaption class="text-center">Topologija lab-a: isti ROAS, ali se trunk između SW1 i R1 sada sastoji od dva fizička linka u lag1</figcaption>
</figure>

## Faza 2 – Početna konfiguracija

Za početak koristim sačuvane konfig i `clab.yml` fajlove iz [prošlog lab-a](/sr/posts/lab-2-roas/). Veze i hostovi ostaju isti, a jedina promjena koju ćemo za sada da uradimo je što ćemo u `links` dodati i drugi fizički link između `sw1` i `r1`:

```yaml
  links:
    # <-> between host10 and sw1
    - endpoints: ["sw1:e1-2", "host10:eth1"]
    # <-> between host20 and sw1
    - endpoints: ["sw1:e1-3", "host20:eth1"]
    # <-> between host30 and sw1
    - endpoints: ["sw1:e1-4", "host30:eth1"]
    # <-> between sw1 and r1
    - endpoints: ["sw1:e1-1", "r1:e1-1"]
    - endpoints: ["sw1:e1-5", "r1:e1-5"]
```

## Faza 3 – Konfigurisanje R1

R1 sam izabrao kao prvi uređaj koji ću da rekonfigurišem. Prva stvar koju radimo je kreiranje `lag1` logičkog interfejsa. Ista konfiguracija za lag interfejs se kasnije upisuje i na SW1.

```
set / interface lag1 admin-state enable
set / interface lag1 vlan-tagging true
set / interface lag1 lag lag-type lacp
set / interface lag1 lag min-links 1
set / interface lag1 lag lacp-fallback-mode static
set / interface lag1 lag lacp-fallback-timeout 4
set / interface lag1 lag lacp interval FAST
set / interface lag1 lag lacp lacp-mode ACTIVE
```

Redom: `lag-type lacp` kaže da LAG koristi LACP (a ne statičku agregaciju), `min-links 1` da LAG ostaje živ dok god je bar jedan član gore, `lacp-mode ACTIVE` da ovaj uređaj sam šalje LACPDU frejmove, a `interval FAST` da ih šalje svake sekunde (pored FAST postoji i SLOW, koji ih šalje na svakih 30 sekundi). Na `lacp-fallback-mode static` i `lacp-fallback-timeout 4` ću se vratiti malo kasnije, jer sam zbog njih u jednom trenutku naišao na "problem".

Zatim na R1 prebacujemo subinterface-e sa `ethernet-1/1` na `lag1`, pa umjesto `ethernet-1/1.10`, `1/1.20` i `1/1.30` sada imamo `lag1.10`, `lag1.20` i `lag1.30`. Ovo radimo jer će `lag1` sada biti logička jedinica sa koje se vrši inter-VLAN rutiranje. Kad port postane član LAG-a, sva L2/L3 konfiguracija (VLAN tagovanje, IP adrese, subinterface-i, članstvo u network instance-u) treba da bude na `lag1`, a ne na fizičkom portu.

Za VLAN 10 to izgleda ovako, a VLAN 20 i 30 su isti, samo sa drugim ID-jem i adresom:

```
enter candidate
delete / network-instance default interface ethernet-1/1.10
delete / interface ethernet-1/1 subinterface 10
delete / interface ethernet-1/1 vlan-tagging
set / interface lag1 subinterface 10 type routed
set / interface lag1 subinterface 10 admin-state enable
set / interface lag1 subinterface 10 ipv4 admin-state enable
set / interface lag1 subinterface 10 ipv4 address 10.0.10.1/24
set / interface lag1 subinterface 10 vlan encap single-tagged vlan-id 10
set / network-instance default interface lag1.10
```

Nakon toga ostaje da fizičke interfejse `ethernet-1/1` i `ethernet-1/5` pripišemo kao članove LAG grupe `lag1`. Isti postupak se radi i na SW1.

```
set / interface ethernet-1/1 ethernet aggregate-id lag1
set / interface ethernet-1/1 ethernet lacp-port-priority 999
set / interface ethernet-1/5 ethernet aggregate-id lag1
set / interface ethernet-1/5 ethernet lacp-port-priority 1
commit now
```

Da rezimiram R1: subinterface-i `lag1.10/20/30` su `routed` sa IP adresama i nalaze se u `network-instance default`, dok fizički portovi (`ethernet-1/1`, `ethernet-1/5`) više nemaju ni subinterface-e ni `vlan-tagging` jer smo to prebacili na `lag1`.

### Zašto je LAG "up" iako SW1 još nije podešen?

Ovde sam se susreo sa jednom nejasnoćom… Nakon što sam commitovao promjene na R1, bez ikakve konfiguracije na SW1, `lag1` na R1 se prikazivao kao "up". Kako, ako lag na SW1 još nije ni podešen?

Nakon kratke konsultacije sa AI, shvatio sam da se to desilo zbog gore upisanih komandi: `lacp-fallback-mode static` i `lacp-fallback-timeout 4`. To efektivno znači da, ukoliko LACP ne pronađe peer-a u okviru 4 sekunde, jedan od članova LAG-a postaje statički fallback interfejs i LAG ostaje podignut bez ikakvog LACP pregovaranja. U mom slučaju to se taman poklopilo i sa `lacp-port-priority 1` na `ethernet-1/5`, jer fallback bira onaj član sa najboljim prioritetom (niži broj = veći prioritet).

Dokaz za ovo sam našao u outputu komande `info from state interface lag1 lag`:

- `partner-id 00:00:00:00:00:00`, `partner-port-num 0`
- `lacp-in-pkts 0` (nijedan LACPDU nije primljen), a `lacp-out-pkts` raste (R1 uporno šalje LACPDU bez da iko jadniku odgovori)
- `synchronization OUT_SYNC`, `collecting false`, `distributing false`
- a ipak je član `oper-state up`?

To znači da `oper-state up` na LAG-u ne dokazuje da LACP radi. Za to se gledaju druga gorenavedena polja.

## Faza 4 – Konfigurisanje SW1

Prvo pravimo isti `lag1` interfejs kao i na R1, sa istim LAG podešavanjima. Jedina razlika je što ovde subinterface-e podešavamo kao `type bridged` umjesto `type routed`, i bez IP adresa, jer je switch na L2.

Ovde sam pogriješio jer sam flat konfiguraciju `lag1` sa R1 samo zalijepio na SW1, pa su sa njom stigle i IP adrese i `routed` tip. To sam ovde morao da prepravljam.

```
set / interface lag1 admin-state enable
set / interface lag1 vlan-tagging true
set / interface lag1 subinterface 10 type bridged
set / interface lag1 subinterface 10 admin-state enable
set / interface lag1 subinterface 10 vlan encap single-tagged vlan-id 10
# isto i za subinterface 20 i 30, uz LAG podešavanja identična onima sa R1

set / interface ethernet-1/1 ethernet aggregate-id lag1
set / interface ethernet-1/1 ethernet lacp-port-priority 999
set / interface ethernet-1/5 admin-state enable
set / interface ethernet-1/5 ethernet aggregate-id lag1
set / interface ethernet-1/5 ethernet lacp-port-priority 1
```

Tri `mac-vrf` network instance-a zatim prebacujemo sa `ethernet-1/1.X` na `lag1.X` subinterface-e:

```
delete / network-instance vlan10 interface ethernet-1/1.10
set / network-instance vlan10 interface lag1.10
# isto i za vlan20 (lag1.20) i vlan30 (lag1.30)
commit now
```

## Faza 5 – LACP aktivan

Nakon commit-a na oba uređaja, LACP je vrlo brzo automatski proradio. `interval FAST` (1s) je omogućio da konvergencija bude veoma kratka.

Kako izgleda aktivan LACP? Ovo su neke od stvari koje možemo da vidimo preko komande `info from state interface lag1 lag` na R1:

- `partner-id` na R1 = `system-id` na SW1 i obrnuto
- `synchronization IN_SYNC`, `collecting true`, `distributing true` na oba člana
- `lacp-in-pkts` raste, greške su 0
- `lag-speed` skočio sa 25000 (jedan član u fallback-u) na 50000 (2 × 25G)

## Faza 6 – Failure test

Na R1 sam spustio `ethernet-1/5` (`admin-state disable`). Za taj interfejs u `info from state interface lag1 lag` piše `oper-down-reason port-disabled`, a na SW1 `port-oper-disabled`. Drugi, aktivni član je ostao `IN_SYNC`, a `lag-speed` je pao na 25000.

LAG je nakon gašenja jednog člana ostao aktivan, što znači da smo postigli redundansu koju smo spominjali na početku lab-a.

## Faza 7 – "Pakovanje" za replikaciju

Kao i u prošlim lab-ovima, konfiguracije oba uređaja sam izvukao u `.cli` fajlove u `/configs` podfolderu (`r1.cli` i `sw1.cli`) i referencirao ih kao `startup-config` u topologiji.
Inače, baš me nervira što `info flat` na uređaju sadrži i stvari koje containerlab sam dodaje (`system tls`, `network-instance mgmt`, `mgmt0`), i onda moram da pazim šta kopiram u config, jer ne želim da ostavim nešto nepotrebno. Ukoliko postoji komanda koja ispisuje sam user-generated config, molim vas javite mi.

Preko AI-ja sam prepravio i `verify.sh` skriptu. Prva verzija je provjeravala samo ping-ove, što je ovde problem, jer bi zbog fallback-a prošla čak i sa pokvarenim LACP-om. Nova verzija prvo provjerava LACP, a tek onda ide na provjeru gateway-a i inter-VLAN ping-ova (TTL 64 do gateway-a, odnosno 63 kroz R1).

Ovaj lab možete naći na linku: [github.com/MilosGlamocak/network-labs](https://github.com/MilosGlamocak/network-labs/tree/master/basic/roas-lag).

> [!TIP] Ključne lekcije iz ovog laba
>
> - LACP ne kreira LAG. LAG-ove pravim i dodajem im članove ručno, na obe strane. LACP samo pregovara koji članovi su aktivni.
> - `lacp-fallback-mode static` može da održi LAG "up" i bez LACP partnera, pa `oper-state up` ne dokazuje da LACP radi. Zato moram da gledam druga polja: `partner-id`, `IN_SYNC` i `collecting`/`distributing`.
> - U fallback-u aktivan ostaje član sa najnižim `lacp-port-priority` brojem.
