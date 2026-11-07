---
title: "O meni"
description: "Kontekst iza ovog bloga — zašto ga pišem i kako se pripremam za seriju containerlab labova."
---

## Ukratko

- Full-stack web developer, godinu i po iskustva, prelazim u mrežno inženjerstvo/security
- CCNA položen, trenutno gradim praktično iskustvo kroz containerlab labove (Nokia SR Linux, VyOS, OPNsense...) i učim za FortiOS Administrator NSE4 ispit 
- Svaki lab je dokumentovan hronološki — sa svim greškama i debug-om
- Sve konfiguracije su javno dostupne na [GitHub-u](https://github.com/MilosGlamocak)

## Kontekst

Ovaj serijal pravim kako bih dokumentovao svoje učenje u mrežnoj struci. Prethodno znanje iz mreža bih opisao kao tehnički šturo, ali teoretski solidno, te mogu da se snađem u raznim tekstovima i razumijem proces razmišljanja iza nekog stvarnog rješenja. Imam tehničko razumijevanje u IT-u prvenstveno preko development pozadine (imam godinu i po iskustva u full-stack web developmentu). Dobar dio trenutnog razumijevanja mreža sam stekao i preko učenja za CCNA ispit, koji sam nedavno položio.

Poguran težnjama za stabilnijom i perspektivnijom karijerom, prvenstveno zbog sve češće pojave mijenjanja junior i mid-level programera sa AI modelima sa utopijskim ciljem dobijanja jeftinijeg a produktivnijeg biznis modela, odlučio sam da svoju karijeru okrenem u pravcu one IT struke za koju smatram da nije moguće da se u velikoj mjeri zamijeni vještačkom inteligencijom. Nakon ove izjave je moguće da ću izgledati i kao licemjer jer i sam koristim AI svakodnevno, čak i kao jedan od glavnih alata za učenje i završavanje svog full time web development posla. Od ovoga se ne može pobjeći i istina je da nas čini produktivnijim, ali me plaši cijena te produktivnosti na duge staze. Ovo je duboka tema na koju ni jedan pojedinac ne može da da definitivan odgovor, te neću mnogo vremena da trošim na nju.

## Priprema

Budući da nisam imao sreće u traženju junior network engineer ili junior network security posla sa trenutnim CV-em, shvatio sam da HR timovima nije pretjerano bitna moja pozadina u programiranju i to što formalno imam neko znanje o mrežama. Logično je da je iskustvo u radu sa mrežama na prvom mjestu, ali tu ulazimo u onu klasičnu priču o začaranom krugu traženja posla bez iskustva dok ti treba iskustvo da bi našao posao.

Iz tog razloga sam došao na ideju da kreiram kolekciju containerlab projekata u kojima ću da pokažem svoj proces razmišljanja pri konfigurisanju stvarnih mrežnih topologija potencijalnom poslodavcu. Sve što ću ovde koristiti mi je novo, jedini model mrežnog operativnog sistema sa kojim sam radio je Cisco IOS i nešto malo FortiOS, mada nikada nisam koristio Nokia SR Linux, VyOS, OPNsense i slične. Izabrao sam njih jer su besplatni za rad i čujem da se koriste i u stvarnim okruženjima.

Koristiću draw.io za kreiranje ilustracija mrežnih topologija i planiranje, te ću sve svoje konfiguracije okačiti na javni GitHub repozitorijum kako bi labovi mogli biti rekreirani i na drugim uređajima.

Budući da nemam iskustva ni sa containerlab-om, niti sa Nokia SR Linux, prvih par labova će biti puko upoznavanje sa njihovim funkcionalnostima i načinom rada.

Izabrao sam SR Linux kao primarni L3 uređaj za moje labove jer je otvoren (ne "open-source otvoren"), besplatan i čuo sam da se koristi u produkcijskim okruženjima širom svijeta. Alternativa koju sam uspio da nađem je VyOS, mada njega bih morao da pokrećem kao kompletnu virtuelnu mašinu, tako da mi je za sada Nokia SRL favorit.

## Roadmap

Ovo je plan labova koji je podložan promjenama.

1. [Site-to-site (static routing)](/sr/posts/lab-1-site2site-static/)
2. [ROAS: inter-VLAN rutiranje](/sr/posts/lab-2-roas/)
3. [ROAS + LAG/LACP](/sr/posts/lab-3-lacp/)
4. Inter-VLAN filtering sa ACL-om _(sljedeći)_
5. Spanning Tree: petlja u mreži i šta se desi kad padne root bridge
6. VRRP
7. OSPF nad ROAS campusom, uz BFD
8. Multi-vendor OSPF (SR Linux + FRR)
9. IS-IS underlay
10. eBGP prema "ISP-u"
11. BGP policy: dual-homed korisnik (local-pref, AS-path prepend)
12. VRF-ovi i route leaking
13. Site-to-site IPsec preko "interneta"
14. Firewall sa DMZ-om (VyOS, OPNsense ili FortiGate)
15. WireGuard za remote access
16. Monitoring: SNMP, syslog i Grafana
17. Suricata IDS (nmap skeniranje i alerti)
18. RADIUS / TACACS+ za login na mrežne uređaje
19. Wazuh SIEM (ako mi RAM dozvoli)
20. Python skripta za backup i provjeru konfiguracija
21. Cijela mreža iz jednog YAML-a: Jinja2 + Ansible
22. NetBox kao source of truth
23. GitHub Actions podiže lab i pokreće `verify.sh` na svaki push
24. Pokvarena mreža: namjerno ubacim greške i dokumentujem kako sam ih našao
25. Završni lab: firma sa sjedištem, filijalom i "ISP-om", sve podignuto iz koda
26. Za kraj, iz znatiželje: leaf-spine i EVPN-VXLAN

## Kontakt

- GitHub: [github.com/MilosGlamocak](https://github.com/MilosGlamocak)
- LinkedIn: [linkedin.com/in/milos-g-421100203](https://www.linkedin.com/in/milos-g-421100203/)
- Email: milosglamocak[at]gmail[dot]com
