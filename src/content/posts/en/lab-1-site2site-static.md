---
pubDatetime: 2026-09-29T00:00:00Z
title: "Lab 1: site2site-static"
featured: true
draft: false
tags:
  - containerlab
  - nokia-srlinux
  - networking
  - static-routing
  - ccna
description: "First lab: a site-to-site link between two LANs over two Nokia SR Linux routers in containerlab, with the mistakes and fixes along the way."
---

The first lab I planned to cover is a simple site-to-site connection between two LANs. I'll use two SR Linux routers as the default gateway for each of those LANs, and one Alpine Linux instance to simulate an endpoint in each network.

## Table of contents

## Phase 1 – Topology and first deploy

The two internal networks will use the subnets `192.168.100.0/24` and `192.168.200.0/24`, while the link between the two routers will be a much narrower subnet, `10.0.0.0/30` (I could have used a `/31` prefix length too, but I decided on `/30` at the time).

The easiest way for me to plan a network implementation is to draw the topology right away in some program, so I don't get lost while configuring the devices. For this lab I used [draw.io](https://draw.io).

<figure>
  <img src="/Basic-P2P.drawio.svg" alt="Topology of the site2site-static lab: srl1 and srl2 (Nokia SR Linux) connected over a 10.0.0.0/30 link, each with one Alpine client (client1, client2) in its own LAN" class="w-full h-auto" />
  <figcaption class="text-center">Lab topology: two LANs connected through two SR Linux routers</figcaption>
</figure>

After designing the topology, I started writing the `*.clab.yml` file, which is essentially the blueprint from which containerlab creates the network topology between individual docker containers. Containerlab has detailed documentation on its website, thanks to which I almost managed to write a correct config file on the first try. My AI buddy pointed out that I had wired the devices incorrectly in the configuration, using a single `endpoints` list key containing three pairs of links instead of three separate `endpoints` keys.

The configuration ended up looking like this, and the deploy succeeded.

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

## Phase 2 – Basic CLI configuration on SR Linux

This is where I first came across the candidate/running configuration model. Until now, whenever I worked in a Cisco IOS environment, any change I made to the configuration was visible in real time. That's not the case in the Nokia SRL environment.

The way to change the configuration in this new environment is different in that I have to enter another "profile" of the CLI to make some changes, and only when I'm satisfied with them can I copy them into the device's current configuration. Here I came across a mechanism familiar to me, `diff`, which basically works like `git diff` – showing how much my candidate configuration deviates from the running configuration and everything I've written.

I also immediately ran into the principle of subinterfaces as logical units at the L3 level. I had worked with this principle before in a Cisco environment, when I implemented a Router-on-a-stick topology for inter-VLAN routing, although it felt strange to me here that I have to do it even when I just want to create a plain connection to an end-user device.

```
--{ candidate shared default }--[ interface ethernet-1/1 subinterface 0 ]--
A:srl1# set admin-state enable
--{ * candidate shared default }--[ interface ethernet-1/1 subinterface 0 ]--
A:srl1# set ipv4 address 192.168.100.254/24
```

Also, it seems I have to manually bind every L3 subinterface to the routing table I want it to live in??? To me, this makes sense with additional VRF tables, but even the default routing table (in the Nokia SRL world, `network-instance default`) requires an explicit binding between it and the interface? Why?

```
--{ * candidate shared default }--[  ]--
A:srl1# set network-instance default interface ethernet-1/1.0
--{ * candidate shared default }--[  ]--
A:srl1# set network-instance default interface ethernet-1/2.0
```

One thing I have to mention because I liked it a lot is the hierarchical navigation style, I think it's called a tree structure, and it lets me change my relative location in the CLI and through it access different levels of the configuration. That is, from the "root" I can type every command, but if I'm in the settings for subinterface 0 on interface ethernet1/1, only the commands for manipulating that subinterface will be available to me.

After a somewhat longer period of finding my way around the new environment, I managed to address the interfaces on both routers.

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

## Phase 3 – Static routes

Now that I had addressed the interfaces on the routers, the next step was creating static routes toward the opposite LAN networks.

The main problem I ran into was that I didn't know how to set a static route in the SRL environment. In Cisco IOS I would write:

```
conf t
ip route 192.168.200.0 255.255.255.0 10.0.0.2
```

but in SRL I would have been lost without AI help. I realized that my only saving grace in this lab is that I theoretically know what the next step should be, and for everything else I can give instructions to an AI agent that will search the documentation for me and suggest concrete actions according to my requirements.

I found out that Nokia SRL also doesn't accept a next-hop route directly, but needs something called a `next-hop-group` (as the name itself says, an object that contains multiple possible next hops toward destinations). One of the benefits of this approach is the possible configuration of ECMP load balancing. On srl1 it looked like this:

```
--{ candidate shared default }--[  ]--
A:srl1# set network-instance default next-hop-groups group to-srl2 nexthop 0 ip-address 10.0.0.2
--{ * candidate shared default }--[  ]--
A:srl1# set network-instance default static-routes route 192.168.200.0/24 next-hop-group to-srl2
```

On srl2 the configuration is mirrored (a `to-srl1` next-hop-group with `10.0.0.1`, and a static route toward `192.168.100.0/24`).

## Phase 4 – Addressing the clients

I tried to connect to one of the Alpine clients, but my SSH connection attempt kept returning "connection refused". It turned out that this is because the Alpine image has no SSH server by default (while SR Linux devices have it active right away). That means the standard practice for connecting to lightweight client devices like these in Docker is `docker exec -it ... sh`. After connecting successfully, I was able to manually address the clients with Linux commands:

```
$ docker exec -it client1 sh
/ # ip addr add 192.168.100.1/24 dev eth1
/ # ip link set eth1 up
/ # ip route add default via 192.168.100.254 dev eth1
```

The same goes for `client2`, only with `192.168.200.1/24` and the default gateway `192.168.200.254`.

## Phase 5 – "no-ip-config" debugging

After I addressed srl1, the ping test returned `Network is unreachable` even for directly connected links. The `show interface` command showed the subinterface as down, with the reason `no-ip-config`, even though the IP address was present in the configuration.

I started checking things one by one: the network-instance binding (did I accidentally forget to add that subinterface? I hadn't, it was correct) and the L1 status, which was up… In the end I asked Claude to try to find the answer online in the actual SR Linux documentation, and we found the real cause: in the YANG model I ran into, it's not enough to add IPv4 to a particular logical subinterface instance and explicitly "enable" it with `set admin-state enable` – you also have to explicitly allow the IPv4 process on that subinterface to run, with the command `set ipv4 admin-state enable`.

After I applied these commands on all the subinterfaces on both routers, pings with a distance of 1 hop worked. What still didn't work was the site-to-site ping.

## Phase 6 – Default route problem on the clients and end-to-end testing

I managed to get point-to-point pings working between the routers, as well as pings between the directly connected clients and the routers, but the end-to-end pings between the two clients still didn't work…

At first I suspected a problem with the static routes, but after a quick check I saw that everything looked fine there. After that, the next logical thing to check was, of course, the default route on the client devices themselves, because it's possible that the clients don't know which next hop to send the ICMP Echo Reply packet to, even though they know the final destination for the reply from the Source in the IP packet. It turned out that my previous command for naming the edge routers in these LANs as the default gateway for the clients didn't pay off because, as Claude explained to me later, the `ip route add default via …` command didn't overwrite the initial default route that the Alpine devices got when the lab was initialized. After `ip route del default` + `ip route add default…` I managed to get an end-to-end ping working between the two devices as well. That completed this lab, so I could get started on "packaging" it for later replication.

## Phase 7 – "Packaging" for replication

For the Alpine config to survive a redeploy, I had to write it into the `exec` block in the `.clab.yml` file. I also replaced `ip route del default` + `ip route add default` with a single `ip route replace default`.

So that I wouldn't push the full lab folder with live containers to GitHub, in addition to creating a `.gitignore` file I also had to extract the full config commands for both routers so I could reference them as the startup config in `sudo containerlab deploy`. I wrote two `.cli` files in a `/configs` subfolder, named `srl1` and `srl2`.

```yaml file="site2site-static.clab.yml"
name: site2site-static

topology:
  nodes:
    srl1:
      kind: nokia_srlinux
      image: ghcr.io/nokia/srlinux:24.10
      startup-config: configs/srl1.cli
    srl2:
      kind: nokia_srlinux
      image: ghcr.io/nokia/srlinux:24.10
      startup-config: configs/srl2.cli
    client1:
      kind: linux
      image: alpine:latest
      exec:
        - ip addr add 192.168.100.1/24 dev eth1
        - ip link set eth1 up
        - ip route replace default via 192.168.100.254 dev eth1
    client2:
      kind: linux
      image: alpine:latest
      exec:
        - ip addr add 192.168.200.1/24 dev eth1
        - ip link set eth1 up
        - ip route replace default via 192.168.200.254 dev eth1
  links:
    # <-> between 2 routers
    - endpoints: ["srl1:e1-2", "srl2:e1-2"]
    # <-> between router1 and client1
    - endpoints: ["srl1:e1-1", "client1:eth1"]
    # <-> between router2 and client2
    - endpoints: ["srl2:e1-1", "client2:eth1"]
```

And the `startup-config` files for both routers:

```txt file="configs/srl1.cli"
set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 192.168.100.254/24
set / interface ethernet-1/2 admin-state enable
set / interface ethernet-1/2 subinterface 0 admin-state enable
set / interface ethernet-1/2 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/2 subinterface 0 ipv4 address 10.0.0.1/30
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface ethernet-1/2.0
set / network-instance default next-hop-groups group to-srl2 nexthop 0 ip-address 10.0.0.2
set / network-instance default static-routes route 192.168.200.0/24 next-hop-group to-srl2
```

```txt file="configs/srl2.cli"
set / interface ethernet-1/1 admin-state enable
set / interface ethernet-1/1 subinterface 0 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/1 subinterface 0 ipv4 address 192.168.200.254/24
set / interface ethernet-1/2 admin-state enable
set / interface ethernet-1/2 subinterface 0 admin-state enable
set / interface ethernet-1/2 subinterface 0 ipv4 admin-state enable
set / interface ethernet-1/2 subinterface 0 ipv4 address 10.0.0.2/30
set / network-instance default interface ethernet-1/1.0
set / network-instance default interface ethernet-1/2.0
set / network-instance default next-hop-groups group to-srl1 nexthop 0 ip-address 10.0.0.1
set / network-instance default static-routes route 192.168.100.0/24 next-hop-group to-srl1
```

After I tested that the lab works from scratch, I saved it to a public GitHub repository at: [github.com/MilosGlamocak/network-labs](https://github.com/MilosGlamocak/network-labs/tree/master). After this I'm continuing to get to know containerlab and Nokia SRL devices through a few more not-so-complex labs, before I dive into some slightly more complex topologies.

> [!TIP] Key lessons from this lab
> - SR Linux works on a candidate/running model – changes are first written to the candidate, then `commit`-ted, similar to `git diff` before a push.
> - Every L3 subinterface must be explicitly bound to a `network-instance` (even `default`) – adding an address alone is not enough.
> - `admin-state enable` turns on the interface/subinterface, but the IPv4 protocol on it has to be enabled separately with `ipv4 admin-state enable` – without it you get a `no-ip-config` error.
> - Static routes don't go directly to a next hop, but through a `next-hop-group` object – which incidentally opens the door to ECMP.
> - `ip route add default` on Linux hosts doesn't overwrite an existing default route – use `ip route replace default` for that.
