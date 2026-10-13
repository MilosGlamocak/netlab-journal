---
pubDatetime: 2026-10-13T00:00:00Z
title: "Lab 2: ROAS (router on a stick)"
featured: true
draft: false
tags:
  - containerlab
  - nokia-srlinux
  - networking
  - vlan
  - inter-vlan-routing
  - ccna
description: "Drugi lab: inter-VLAN rutiranje preko router-on-a-stick topologije sa dva Nokia SR Linux uređaja (L2 switch i L3 ruter) u containerlab-u."
---

Lab koji radim danas je klasična Router on a Stick topologija sa 3 VLAN-a, jednim L2 i jednim L3 uređajem. Na switch će preko access linkova biti povezane po 3 klijentske Alpine Linux instance, od kojih će svaka da bude u svom odvojenom VLAN-u. Veza između switch-a i router-a će da bude trunk link, koja će da nosi sva 3 VLAN-a ruteru, te će on na svom routing plane-u da radi inter-VLAN rutiranje.

Budući da sam u prvom lab-u krenuo da učim Nokia SR Linux NOS, logično bi bilo da nastavim tom putanjom, pa sam odlučio da mi taj NOS služi i za L2 i L3 uređaje u ovom i narednim lab-ovima (Nokia SRL može da radi i kao switch, bez uključenih IP servisa na uređaju).

## Table of contents

## Faza 1 – Plan i topologija

Ispod se nalazi topologija mreže koju ćemo da kreiramo u ovom lab-u.

<figure>
  <img src="/roas.drawio.svg" alt="Topologija lab-a ROAS: tri Alpine klijenta (HOST10, HOST20, HOST30) u VLAN-ovima 10, 20 i 30 povezani access linkovima na SW1, koji je 802.1Q trunk linkom povezan na ruter R1" class="w-full h-auto" />
  <figcaption class="text-center">Topologija lab-a: tri VLAN-a, jedan L2 switch i jedan L3 ruter na trunk linku</figcaption>
</figure>

## Faza 2 – Pisanje topologije

```yaml
name: roas

topology:
  nodes:
    r1:
      kind: nokia_srlinux
      image: ghcr.io/nokia/srlinux:24.10
    sw1:
      kind: nokia_srlinux
      image: ghcr.io/nokia/srlinux:24.10
    host10:
      kind: linux
      image: alpine:latest
      exec:
        - ip addr add 10.0.10.10/24 dev eth1
        - ip route replace default via 10.0.10.1
    host20:
      kind: linux
      image: alpine:latest
      exec:
        - ip addr add 10.0.20.10/24 dev eth1
        - ip route replace default via 10.0.20.1
    host30:
      kind: linux
      image: alpine:latest
      exec:
        - ip addr add 10.0.30.10/24 dev eth1
        - ip route replace default via 10.0.30.1

  links:
    # <-> between host10 and sw1
    - endpoints: ["sw1:e1-2", "host10:eth1"]
    # <-> between host20 and sw1
    - endpoints: ["sw1:e1-3", "host20:eth1"]
    # <-> between host30 and sw1
    - endpoints: ["sw1:e1-4", "host30:eth1"]
    # <-> between sw1 and r1
    - endpoints: ["sw1:e1-1", "r1:e1-1"]
```

Početni `roas.clab.yml` fajl izgleda ovako. Odmah sam upisao statičke adrese na host uređajima, kako ne bih morao naknadno da ih unosim pri svakoj konekciji preko docker-a.

Stvar koju ovde želim da naglasim: umjesto `ip route add default via…` koristim `ip route replace default via…`. Razlog tome je taj da Alpine instance pri provisioning-u odmah dodaju default rutu koja bi ostala primarna čak i da dodamo novu preko komandne linije. Pošto mi se `replace` čini kao najbrži način da riješimo ovaj problem, ostajem pri ovakvom pristupu.

## Faza 3 – Konfigurisanje SW1

Naredni korak koji sam krenuo da radim je konfigurisanje L2 uređaja koji je direktno povezan sa host-ovima. Ovde sam se susreo sa nekoliko novih pojmova povezanih sa L2 switching-om na ovom NOS-u.

Naime, klasično raspoređivanje VLAN-ova po switchport-ovima kao na Cisco IOS-u ovde nije bilo moguće. Cisco se opredijelio za, po meni, dosta jednostavniji pristup. Koliko se sjećam, tamo je dovoljno upisati:

```
interface fastethernet1/0
switchport mode access
switchport access vlan 10
```

Te bi sa ovom komandom taj interface bio dodijeljen VLAN-u broj 10.

Naravno, ovakav pristup nije moguć kod Nokia SRL modela konfiguracije, gdje je, po mom shvatanju, prvo potrebno kreirati odvojenu `mac-vrf` instancu, koja predstavlja jedan L2 broadcast domain sa vlastitom MAC tabelom.

Kreiranje `mac-vrf`-a ide ovako:

```
--{ running }--[  ]--
A:sw1# enter candidate
--{ candidate shared default }--[  ]--
A:sw1# set / network-instance vlan10 type mac-vrf
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan10 admin-state enable
```

Ovo znači da se VLAN-ovi u ovom NOS-u razdvajaju na dva mjesta:

1. port koji je podešen da prihvati frejmove sa tog VLAN-a,
2. `mac-vrf` instanca, koja je nešto slično dijeljenju virtuelnih routing plane-ova, samo sada na L2.

Isto ponavljam i za `vlan20` i `vlan30`.

### Access portovi

Interfejsi koje sam izabrao za access portove bi trebali imati i `vlan-tagging false` podešen. To, kako sam shvatio, govori interfejsu da ne šalje i ne očekuje dot1q tagove na saobraćaju koji prolazi kroz njega. Nakon toga, potrebno je ponovo odabrati virtuelni subinterface koji će biti zadužen za access port saobraćaj i njegov `type` prebaciti u `bridged` i uključiti ga preko `set admin-state enable`.

```
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/2 admin-state enable
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/2 vlan-tagging false
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/2 subinterface 0 type bridged
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/2 subinterface 0 admin-state enable
```

Isto važi i za `ethernet-1/3` i `ethernet-1/4`. Ove access portove je takođe, kako smo vidjeli i u prvom lab-u, potrebno povezati sa svojom network instancom.

```
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan10 interface ethernet-1/2.0
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan20 interface ethernet-1/3.0
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan30 interface ethernet-1/4.0
```

### Trunk port ka ruteru

Nakon konfiguracije access port-ova, vrijeme je za konfiguraciju trunk porta ka router-u.

Za razliku od interfejsa koji služi kao access port, ovaj interfejs mora da ima `vlan-tagging true`. Na ovom interface-u ćemo da kreiramo sva 3 subinterface-a koji će nam služiti za trunking saobraćaja prema router-u. Ove podinterfejse takođe stavljamo u `type bridged`, ali je potrebno da im omogućimo tagovanje, kako bi se mogao raspoznati saobraćaj između više VLAN-ova. To radimo sa komandom `vlan encap single-tagged vlan-id {id}`.

```
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 admin-state enable
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 vlan-tagging true
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 subinterface 10 type bridged
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 subinterface 10 admin-state enable
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 subinterface 10 vlan encap single-tagged vlan-id 10
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 subinterface 20 type bridged
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 subinterface 20 admin-state enable
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 subinterface 20 vlan encap single-tagged vlan-id 20
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 subinterface 30 type bridged
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 subinterface 30 admin-state enable
--{ * candidate shared default }--[  ]--
A:sw1# set / interface ethernet-1/1 subinterface 30 vlan encap single-tagged vlan-id 30
```

Nakon njihovog podešavanja, potrebno je i ove podinterfejse povezati na njihove `mac-vrf` mrežne instance, a zatim sve promjene upisati u running konfiguraciju.

```
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan10 interface ethernet-1/1.10
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan20 interface ethernet-1/1.20
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan30 interface ethernet-1/1.30
--{ * candidate shared default }--[  ]--
A:sw1# commit now
All changes have been committed. Leaving candidate mode.
```

Sa tim smo završili konfiguraciju na SW1.

## Faza 4 – Konfigurisanje R1

Što se tiče konfiguracije na R1, kreiramo isti trunk link kao i na SW1, sa tim što su ovde subinterface-i `routed` tipa i imaju IP adrese, jer želimo da radimo rutiranje na L3 nivou kako bismo mogli "uvezati" ove VLAN-ove. Svaki od ovih subinterface-a sam povezao na `default` network instance. Sa ovim postavkama sam dobio 3 connected rute na jednom fizičkom interfejsu i na istoj routing tabeli.

Za VLAN 10 to izgleda ovako, a za VLAN 20 i 30 je isto, samo sa drugim ID-jem i adresom (`10.0.20.1/24` i `10.0.30.1/24`):

```
--{ running }--[  ]--
A:r1# enter candidate
--{ candidate shared default }--[  ]--
A:r1# set / interface ethernet-1/1 admin-state enable
--{ * candidate shared default }--[  ]--
A:r1# set / interface ethernet-1/1 vlan-tagging true
--{ * candidate shared default }--[  ]--
A:r1# set / interface ethernet-1/1 subinterface 10 type routed
--{ * candidate shared default }--[  ]--
A:r1# set / interface ethernet-1/1 subinterface 10 admin-state enable
--{ * candidate shared default }--[  ]--
A:r1# set / interface ethernet-1/1 subinterface 10 ipv4 admin-state enable
--{ * candidate shared default }--[  ]--
A:r1# set / interface ethernet-1/1 subinterface 10 ipv4 address 10.0.10.1/24
--{ * candidate shared default }--[  ]--
A:r1# set / interface ethernet-1/1 subinterface 10 vlan encap single-tagged vlan-id 10
--{ * candidate shared default }--[  ]--
A:r1# set / network-instance default interface ethernet-1/1.10
--{ * candidate shared default }--[  ]--
A:r1# commit now
All changes have been committed. Leaving candidate mode.
```

## Faza 5 – Verifikacija

Nakon konfiguracije na R1, preostalo je samo da verifikujemo konekciju. Ping ka hostu u drugom VLAN-u bi trebao da vraća ICMP reply sa TTL-om od 63 (jedan hop između – ruter kao gateway), a ping ka ruteru bi trebao da vraća paket sa TTL-om od 64. Takođe, traceroute bi trebao da nam pokaže tačan smjer kojim je paket išao ka drugom host-u.

```
user@fedora:~$ docker exec -it clab-roas-host10 sh
/ # ping 10.0.20.10
PING 10.0.20.10 (10.0.20.10): 56 data bytes
64 bytes from 10.0.20.10: seq=0 ttl=63 time=87.362 ms
64 bytes from 10.0.20.10: seq=1 ttl=63 time=0.555 ms
64 bytes from 10.0.20.10: seq=2 ttl=63 time=0.646 ms
^C
--- 10.0.20.10 ping statistics ---
3 packets transmitted, 3 packets received, 0% packet loss
round-trip min/avg/max = 0.555/29.521/87.362 ms
/ # ping 10.0.10.1
PING 10.0.10.1 (10.0.10.1): 56 data bytes
64 bytes from 10.0.10.1: seq=0 ttl=64 time=2.894 ms
64 bytes from 10.0.10.1: seq=1 ttl=64 time=3.902 ms
^C
--- 10.0.10.1 ping statistics ---
2 packets transmitted, 2 packets received, 0% packet loss
round-trip min/avg/max = 2.894/3.398/3.902 ms
/ # traceroute 10.0.30.10
traceroute to 10.0.30.10 (10.0.30.10), 30 hops max, 46 byte packets
 1  10.0.10.1 (10.0.10.1)  1.102 ms  1.129 ms  0.564 ms
 2  10.0.30.10 (10.0.30.10)  10.594 ms  0.988 ms  0.500 ms
```

Takođe, možemo da vidimo da R1 koristi isti MAC od parent interfejsa na svakom od podinterfejsa. Na SW1 se MAC `1A:D6:03:FF:00:01` pojavljuje u MAC tabeli i `vlan10` i `vlan30` instance, naučen preko odgovarajućeg trunk subinterface-a (`ethernet-1/1.10`, odnosno `ethernet-1/1.30`), dok je druga adresa u svakoj tabeli MAC odgovarajućeg host-a na njegovom access portu.

```
--{ running }--[  ]--
A:sw1# show network-instance vlan10 bridge-table mac-table all
Mac-table of network instance vlan10
+-------------------+---------------------------+-----------+--------+--------+-------+---------------------------+
|      Address      |        Destination        |    Dest   |  Type  | Active | Aging |        Last Update        |
|                   |                           |   Index   |        |        |       |                           |
+===================+===========================+===========+========+========+=======+===========================+
| 1A:D6:03:FF:00:01 | ethernet-1/1.10           | 2         | learnt | true   | 126   | 2026-10-13T20:10:37.000Z  |
| AA:C1:AB:13:21:54 | ethernet-1/2.0            | 5         | learnt | true   | 217   | 2026-10-13T20:00:41.000Z  |
+-------------------+---------------------------+-----------+--------+--------+-------+---------------------------+
```

```
--{ running }--[  ]--
A:sw1# show network-instance vlan30 bridge-table mac-table all
Mac-table of network instance vlan30
+-------------------+---------------------------+-----------+--------+--------+-------+---------------------------+
|      Address      |        Destination        |    Dest   |  Type  | Active | Aging |        Last Update        |
|                   |                           |   Index   |        |        |       |                           |
+===================+===========================+===========+========+========+=======+===========================+
| 1A:D6:03:FF:00:01 | ethernet-1/1.30           | 4         | learnt | true   | 126   | 2026-10-13T20:14:11.000Z  |
| AA:C1:AB:F2:15:B3 | ethernet-1/4.0            | 7         | learnt | true   | 120   | 2026-10-13T20:14:40.000Z  |
+-------------------+---------------------------+-----------+--------+--------+-------+---------------------------+
```

## Faza 6 – "Pakovanje" za replikaciju

Kao i u prošlom lab-u, konfiguracije oba uređaja sam izvukao u `.cli` fajlove u `/configs` podfolderu (`r1.cli` i `sw1.cli`) i referencirao ih kao `startup-config` u topologiji, tako da se lab podiže potpuno konfigurisan jednim `containerlab deploy`-om:

```yaml file="roas.clab.yml"
name: roas

topology:
  nodes:
    r1:
      kind: nokia_srlinux
      image: ghcr.io/nokia/srlinux:24.10
      startup-config: configs/r1.cli
    sw1:
      kind: nokia_srlinux
      image: ghcr.io/nokia/srlinux:24.10
      startup-config: configs/sw1.cli
    host10:
      kind: linux
      image: alpine:latest
      exec:
        - ip addr add 10.0.10.10/24 dev eth1
        - ip route replace default via 10.0.10.1
    host20:
      kind: linux
      image: alpine:latest
      exec:
        - ip addr add 10.0.20.10/24 dev eth1
        - ip route replace default via 10.0.20.1
    host30:
      kind: linux
      image: alpine:latest
      exec:
        - ip addr add 10.0.30.10/24 dev eth1
        - ip route replace default via 10.0.30.1

  links:
    # <-> between host10 and sw1
    - endpoints: ["sw1:e1-2", "host10:eth1"]
    # <-> between host20 and sw1
    - endpoints: ["sw1:e1-3", "host20:eth1"]
    # <-> between host30 and sw1
    - endpoints: ["sw1:e1-4", "host30:eth1"]
    # <-> between sw1 and r1
    - endpoints: ["sw1:e1-1", "r1:e1-1"]
```

Preko A.I-ja sam generisao `verify.sh` skriptu koja se nalazi u folderu lab-a i koja testira ping-ove između uređaja, čime verifikuje da li je mreža korektno podignuta.

Ovaj lab možete naći na linku: [github.com/MilosGlamocak/network-labs](https://github.com/MilosGlamocak/network-labs/tree/master/basic/roas).

> [!TIP] Ključne lekcije iz ovog laba
>
> - Na SR Linuxu se VLAN ne dodjeljuje portu direktno kao na Cisco IOS-u – svaki VLAN je zasebna `mac-vrf` instanca, a port/subinterface se na nju veže eksplicitno.
> - Access port ima `vlan-tagging false`, a trunk `vlan-tagging true` sa po jednim subinterface-om po VLAN-u (`vlan encap single-tagged vlan-id {id}`).
> - Na SW1 su subinterface-i `type bridged`, a na R1 `type routed` sa IP adresom – isti trunk, dvije različite uloge.
