---
pubDatetime: 2026-09-29T00:00:00Z
title: "Lab 1: site2site-static"
slug: lab-1-site2site-static
featured: true
draft: false
tags:
  - containerlab
  - nokia-srlinux
  - networking
  - static-routing
  - ccna
description: "Prvi lab u seriji: site-to-site konekcija između dva LAN-a preko dva Nokia SR Linux rutera u containerlab okruženju — korak po korak, uz sve prepreke i rješenja usput."
---

## Table of contents

## Faza 1 – Topologija i prvi deploy

Prvi lab koji sam planirao da obradim je jednostavna site-to-site konekcija između dva LAN-a. Koristiću dva SR Linux rutera kao default gateway za svaki od tih LAN-ova i po jednu Alpine Linux instancu koja će da simulira po jedan endpoint u svakoj mreži.

Dve interne mreže će da imaju subnete `192.168.100.0/24` i `192.168.200.0/24`, dok će veza između dva rutera da bude dosta uži subnet `10.0.0.0/30` (mogao sam da koristim i `/31` prefiks dužine ali sam se tada opredijelio za `/30`).

Najlakši način za planirati implementaciju neke mreže mi je da odmah nacrtam topologiju u nekom programu, kako se ne bih izgubio tokom konfiguracije uređaja. Za ovaj lab sam koristio [draw.io](https://draw.io).

<figure>
  <img src="/Basic-P2P.drawio.svg" alt="Topologija lab-a site2site-static: srl1 i srl2 (Nokia SR Linux) povezani preko 10.0.0.0/30 linka, svaki sa po jednim Alpine klijentom (client1, client2) u svom LAN-u" class="w-full h-auto" />
  <figcaption class="text-center">Topologija lab-a: dva LAN-a povezana preko dva SR Linux rutera</figcaption>
</figure>

Nakon osmišljanja topologije, krenuo sam da pišem `*.clab.yml` fajl, koji je, u suštini, nacrt po kojem containerlab kreira mrežnu topologiju između pojedinačnih docker kontejnera. Containerlab ima detaljnu dokumentaciju na svom sajtu, preko koje sam skoro uspio da napišem tačan config fajl iz prve. Moj AI prijatelj mi je skrenuo pažnju da sam pogrešno povezao uređaje u konfiguraciji, koristeći jedan `endpoints` ključ liste koji sadrži tri para linkova, umjesto tri odvojena `endpoints` ključa.

Konfiguracija je na kraju izgledala ovako, i deploy je prošao uspješno.

```yaml
name: site2site-static

topology:
  nodes:
    srl1:
      kind: nokia_srlinux
      image: ghcr.io/nokia/srlinux:24.10
    srl2:
      kind: nokia_srlinux
      image: ghcr.io/nokia/srlinux:24.10
    client1:
      kind: linux
      image: alpine:latest
    client2:
      kind: linux
      image: alpine:latest
  links:
    # <-> between 2 routers
    - endpoints: ["srl1:e1-2", "srl2:e1-2"]
    # <-> between router1 and client1
    - endpoints: ["srl1:e1-1", "client1:eth1"]
    # <-> between router2 and client2
    - endpoints: ["srl2:e1-1", "client2:eth1"]
```

## Faza 2 – Osnovna CLI konfiguracija na SR Linuxu

Ovde sam se prvi put susreo sa candidate/running modelom konfiguracije. Do sada, kad god sam radio u Cisco IOS okruženju, koju god promjenu u konfiguraciji uvedem, vidljiva je u realnom vremenu. To nije slučaj kod Nokia SRL okruženja.

Način za promjenu konfiguracije u ovom novom okruženju je drugačiji po tome što moram da uđem u drugi "profil" CLI-a kako bih napravio neke izmjene, pa tek onda kada sam zadovoljan sa njima, mogu da ih prepišem u trenutnu konfiguraciju uređaja. Ovde sam se susreo sa meni poznatim mehanizmom `diff`, koji u principu radi kao `git diff` – prikazujući koliko moja candidate konfiguracija odstupa od running konfiguracije i šta sam ja sve napisao.

Takođe sam se odmah susreo sa principom subinterface-a kao logičkih jedinica na L3 nivou. Sa ovim principom sam radio i prije u Cisco okruženju, kada sam implementirao Router-on-a-stick topologiju za inter-VLAN rutiranje, mada mi je ovde bilo čudno što to moram da uradim i kada želim da kreiram običnu konekciju sa end-user uređajem.

```
--{ candidate shared default }--[ interface ethernet-1/1 subinterface 0 ]--
A:srl1# set admin-state enable
--{ * candidate shared default }--[ interface ethernet-1/1 subinterface 0 ]--
A:srl1# set ipv4 address 192.168.100.254/24
```

Isto tako, izgleda da moram manuelno da povezujem svaki L3 subinterface sa routing tabelom u kojoj želim da se on nalazi??? Po meni, ovo ima smisla sa nekim dodatnim VRF tabelama, ali i default routing tabela (u Nokia SRL svijetu `network-instance default`) isto zahtijeva eksplicitno povezivanje između nje i interfejsa? Zašto?

```
--{ * candidate shared default }--[  ]--
A:srl1# set network-instance default interface ethernet-1/1.0
--{ * candidate shared default }--[  ]--
A:srl1# set network-instance default interface ethernet-1/2.0
```

Jedna stvar koju moram da spomenem jer mi se mnogo svidjela je hijerarhijski stil navigacije, mislim da se zove tree struktura, i ona omogućava da promijenim svoju relativnu lokaciju u CLI-u i da preko nje imam pristup različitim nivoima konfiguracije, to jeste, iz "root-a" mogu da upišem svaku komandu, ali ako se nalazim u podešavanjima za subinterface 0 na interface-u ethernet1/1, biće mi omogućene samo komande za manipulaciju tim subinterface-om.

Nakon malo dužeg perioda snalaženja u novoj sredini, uspio sam da adresiram interfejse na oba rutera.

```
--{ running }--[  ]--
A:srl1# show network-instance default interfaces
=============================================================================================================================
Net instance    : default
Interface       : ethernet-1/1.0
Type            : routed
Oper state      : up
Ip mtu          : 1500
 Prefix                                    Origin       Status
 ===============================================================================================
 192.168.100.254/24                        static       preferred, primary
=============================================================================================================================
Net instance    : default
Interface       : ethernet-1/2.0
Type            : routed
Oper state      : up
Ip mtu          : 1500
 Prefix                                    Origin       Status
 ===============================================================================================
 10.0.0.1/30                               static       preferred, primary
==================================================================================================================
```

## Faza 3 – Static rute

Budući da sam adresirao interfejse na ruterima, sljedeći korak bi bio kreiranje statičnih ruta ka suprotnim LAN mrežama.

Glavni problem na koji sam naišao je taj da nisam znao kako da postavim static rutu u SRL okruženju. U Cisco IOS-u bih pisao:

```
conf t
ip route 192.168.200.0 255.255.255.0 10.0.0.2
```

ali u SRL bih bez AI pomoći bio izgubljen. Shvatio sam da je moj jedini spas u ovom labu što teoretski znam šta bi trebao biti sljedeći korak, a da za sve ostalo mogu da dam instrukcije AI agentu koji će da pretraži dokumentaciju umjesto mene i predloži konkretne akcije shodno sa mojim zahtjevima.

Shvatio sam da Nokia SRL takođe ne prima next-hop rutu direktno, nego joj treba nešto što se zove `next-hop-group` (kao što samo ime kaže, objekat koji sadrži više mogućih next hopova ka destinacijama). Jedan od benefita ovog pristupa je moguća konfiguracija ECMP load-balancing-a.

## Faza 4 – Adresiranje klijenata

Pokušao sam da se konektujem na jednog od Alpine klijenata, ali mi je pokušaj SSH konekcije na njega vraćao "connection refused". Ispostavilo se da je to zato što Alpine image nema SSH server po default-u (dok ga SR Linux uređaji imaju odmah aktivnog). To znači da je standardna praksa za konektovanje na ovakve lagane klijentske uređaje u Docker-u `docker exec -it ... sh`. Nakon uspješne konekcije uspio sam da ručno adresiram klijente sa Linux komandama:

- `ip addr add 192.168.100.1/24 dev eth1`
- `ip link set eth1 up`
- `ip route add default via 192.168.100.254 dev eth1`

## Faza 5 – "no-ip-config" debug

Nakon što sam adresirao srl1, ping test je vraćao `Network is unreachable` čak i za direktno povezane linkove. `Show interface` komanda mi je pokazivala subinterface kao down, sa razlogom `no-ip-config`, iako je IP adresa bila prisutna u konfiguraciji.

Redom sam krenuo da provjeravam network-instance binding (da li sam slučajno zaboravio da dodam taj subinterface? Nisam, bilo je ispravno) i L1 status, koji je bio up… Na kraju sam napisao Claude-u da na internetu u pravoj SR Linux dokumentaciji proba naći odgovor, te smo našli pravi uzrok: u YANG modelu sa kojim sam se susreo, nije dovoljno dodati IPv4 na određenu instancu logičkog subinterface-a i eksplicitno ga "uključiti" sa `set admin-state enable` – potrebno je eksplicitno dozvoliti i IPv4 procesu na tom subinterface-u da radi, sa komandom `set ipv4 admin-state enable`.

Nakon što sam primijenio ove komande na svim subinterface-ima na nivou oba rutera, pingovi sa distancom od 1 hop su sada radili. Ono što i dalje nije radilo je site-to-site ping.

## Faza 6 – Default route problem na klijentima i end-to-end testiranje

Uspio sam da omogućim point-to-point pingove između rutera, kao i pingove između direktno povezanih klijenata sa ruterima, ali mi end-to-end pingovi između dva klijenta i dalje nisu radili…

Prvo sam pomislio na problem sa statičkim rutama, ali nakon brze provjere, vidio sam da se tu sve čini u redu. Nakon toga, sljedeća logična stvar koju bih trebao da provjerim je, razumije se, default ruta na samim klijentskim uređajima, jer je moguće da klijenti ne znaju na koji next-hop da upute ICMP Echo Reply paket, iako iz Source-a u IP paketu znaju krajnju destinaciju za odgovor. Ispostavilo se da moja prošla komanda za imenovanje edge rutera u ovim LAN-ovima kao default gateway za klijente nije urodila plodom, jer, kako mi je Claude kasnije objasnio, komanda `ip route add default via …` nije prepisala početnu default rutu koju su Alpine uređaji dobili pri inicijalizaciji lab-a. Nakon `ip route del default` + `ip route add default…` uspio sam da odradim i end-to-end ping između ta dva uređaja. Time sam kompletirao ovaj lab, pa sam se mogao baciti na njegovo "pakovanje" za kasniju replikaciju.

## Faza 7 – "Pakovanje" za replikaciju

Kako bi Alpine config preživio redeploy, morao sam da ga upišem u `exec` blok u `.clab.yml` fajlu. Takođe sam zamijenio `ip route del default` + `ip route add default` sa jednim `ip route replace default`.

Kako na Github ne bih push-ovao i full lab folder sa živim kontejnerima, pored napravljenog `.gitignore` fajla, takođe sam morao da izvučem full config komande za oba rutera kako bi ih mogao referencirati kao startni config u `sudo containerlab deploy`. Napisao sam dva `.cli` fajla u `/configs` podfolderu sa nazivima `srl1` i `srl2`.

Nakon što sam testirao da lab radi od nule, sačuvao sam ga na javnom GitHub repozitorijumu na linku: [github.com/MilosGlamocak/network-labs](https://github.com/MilosGlamocak/network-labs/tree/master). Nakon ovog nastavljam sa upoznavanjem containerlab-a i Nokia SRL uređaja kroz još par ne toliko složenih lab-ova, prije nego što se bacim na neke malo kompleksnije topologije.
