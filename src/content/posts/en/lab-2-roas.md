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
description: "Second lab: inter-VLAN routing over a router-on-a-stick topology with two Nokia SR Linux devices (an L2 switch and an L3 router) in containerlab."
---

The lab I'm doing today is a classic Router on a Stick topology with 3 VLANs, one L2 device and one L3 device. Three client Alpine Linux instances will be connected to the switch over access links, each one in its own separate VLAN. The link between the switch and the router will be a trunk carrying all 3 VLANs to the router, which will do the inter-VLAN routing on its routing plane.

Since I started learning the Nokia SR Linux NOS in the first lab, it makes sense to continue down that path, so I decided to use it for both the L2 and L3 devices in this and the upcoming labs (Nokia SRL can also act as a switch, without any IP services enabled on the device).

## Table of contents

## Phase 1 – Plan and topology

Below is the network topology we're going to build in this lab.

<figure>
  <img src="/roas.drawio.svg" alt="Topology of the ROAS lab: three Alpine clients (HOST10, HOST20, HOST30) in VLANs 10, 20 and 30 connected over access links to SW1, which is connected to router R1 over an 802.1Q trunk" class="w-full h-auto" />
  <figcaption class="text-center">Lab topology: three VLANs, one L2 switch and one L3 router on a trunk link</figcaption>
</figure>

## Phase 2 – Writing the topology

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

This is what the initial `roas.clab.yml` file looks like. I immediately assigned static addresses on the host devices, so I wouldn't have to enter them manually on every connection through docker.

One thing I want to point out here: instead of `ip route add default via…` I use `ip route replace default via…`. The reason is that Alpine instances add a default route right at provisioning, and it would stay the primary one even if we add a new one from the command line. Since `replace` seems like the quickest way to solve this problem, I'm sticking with this approach.

## Phase 3 – Configuring SW1

The next step was configuring the L2 device that is directly connected to the hosts. Here I ran into several new concepts related to L2 switching on this NOS.

Namely, the classic assignment of VLANs to switchports like on Cisco IOS wasn't possible here. Cisco went with, in my opinion, a much simpler approach. As far as I remember, all it takes there is:

```
interface fastethernet1/0
switchport mode access
switchport access vlan 10
```

And with this, that interface would be assigned to VLAN 10.

Of course, this approach isn't possible in the Nokia SRL configuration model, where, as I understand it, you first need to create a separate `mac-vrf` instance, which represents a single L2 broadcast domain with its own MAC table.

Creating a `mac-vrf` goes like this:

```
--{ running }--[  ]--
A:sw1# enter candidate
--{ candidate shared default }--[  ]--
A:sw1# set / network-instance vlan10 type mac-vrf
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan10 admin-state enable
```

This means that VLANs on this NOS are separated in two places:

1. the port configured to accept frames from that VLAN,
2. the `mac-vrf` instance, which is something similar to splitting virtual routing planes, only now at L2.

I repeat the same for `vlan20` and `vlan30`.

### Access ports

The interfaces I chose as access ports should also have `vlan-tagging false` set. As I understood it, this tells the interface not to send or expect dot1q tags on the traffic passing through it. After that, I need to select the virtual subinterface that will carry the access port traffic again, switch its `type` to `bridged` and enable it with `set admin-state enable`.

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

The same applies to `ethernet-1/3` and `ethernet-1/4`. As we saw in the first lab, these access ports also need to be attached to their own network instance.

```
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan10 interface ethernet-1/2.0
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan20 interface ethernet-1/3.0
--{ * candidate shared default }--[  ]--
A:sw1# set / network-instance vlan30 interface ethernet-1/4.0
```

### Trunk port to the router

After configuring the access ports, it's time to configure the trunk port toward the router.

Unlike the interface used as an access port, this one must have `vlan-tagging true`. On this interface we'll create all 3 subinterfaces that will serve for trunking traffic toward the router. We also put these subinterfaces in `type bridged`, but we need to enable tagging on them so that traffic from different VLANs can be told apart. We do that with the command `vlan encap single-tagged vlan-id {id}`.

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

Once they're configured, these subinterfaces also need to be attached to their `mac-vrf` network instances, and then all the changes committed to the running configuration.

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

With that, we're done with the configuration on SW1.

## Phase 4 – Configuring R1

As for the configuration on R1, we create the same trunk link as on SW1, except that here the subinterfaces are of the `routed` type and have IP addresses, because we want to route at L3 in order to "tie" these VLANs together. I attached each of these subinterfaces to the `default` network instance. With these settings I got 3 connected routes on a single physical interface and in the same routing table.

For VLAN 10 it looks like this, and for VLANs 20 and 30 it's the same, just with a different ID and address (`10.0.20.1/24` and `10.0.30.1/24`):

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

## Phase 5 – Verification

After configuring R1, all that's left is to verify the connectivity. A ping to a host in another VLAN should return an ICMP reply with a TTL of 63 (one hop in between – the router acting as the gateway), and a ping to the router should return a packet with a TTL of 64. Traceroute should also show us the exact path the packet took toward the other host.

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

We can also see that R1 uses the same MAC address of the parent interface on each of its subinterfaces. On SW1, the MAC `1A:D6:03:FF:00:01` shows up in the MAC tables of both the `vlan10` and `vlan30` instances, learned over the corresponding trunk subinterface (`ethernet-1/1.10` and `ethernet-1/1.30` respectively), while the other address in each table is the MAC of the corresponding host on its access port.

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

## Phase 6 – "Packaging" for replication

As in the previous lab, I extracted the configuration of both devices into `.cli` files in the `/configs` subfolder (`r1.cli` and `sw1.cli`) and referenced them as `startup-config` in the topology, so the lab comes up fully configured with a single `containerlab deploy`:

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

I used AI to generate a `verify.sh` script, located in the lab's folder, which tests pings between the devices and thereby verifies whether the network came up correctly.

You can find this lab at: [github.com/MilosGlamocak/network-labs](https://github.com/MilosGlamocak/network-labs/tree/master/basic/roas).

> [!TIP] Key lessons from this lab
>
> - On SR Linux a VLAN isn't assigned to a port directly like on Cisco IOS – each VLAN is a separate `mac-vrf` instance, and the port/subinterface is attached to it explicitly.
> - An access port has `vlan-tagging false`, while a trunk has `vlan-tagging true` with one subinterface per VLAN (`vlan encap single-tagged vlan-id {id}`).
> - On SW1 the subinterfaces are `type bridged`, and on R1 `type routed` with an IP address – the same trunk, two different roles.
