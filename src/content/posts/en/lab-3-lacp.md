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
description: "Third lab: the single trunk link of the ROAS topology replaced with two physical links in a LAG, using dynamic LACP between two Nokia SR Linux devices in containerlab."
---

The goal of this lab is to learn how to implement a Link Aggregation Group (LAG) and the Link Aggregation Control Protocol (LACP) in a Nokia SR Linux environment. I'll be using the ROAS topology from the [previous lab](/en/posts/lab-2-roas/), and I'll replace the single trunk link between the switch and the router with two physical links that work as one logical link.

## Table of contents

## Phase 1 – Plan and topology

### What are LAG and LACP

For the uninitiated, a LAG (or EtherChannel, as it's called in the Cisco world) serves two primary purposes: aggregating the bandwidth of a link and providing redundancy for it. A LAG is a single logical interface made up of a number of physical interfaces, which together act as one logical unit. This concept works at L2 – the ethernet layer of the OSI model.

LACP, on the other hand, is a protocol through which, among other things, two devices negotiate which physical links join the LAG. The LAG itself is still created manually on both sides, but LACP automates and simplifies the decision about which members are active, as well as some other LAG performance settings, by exchanging LACPDUs between the devices.

Instead of a static LAG, I'm configuring LACP in this lab because it's more common in practice.

For somewhat more detailed explanations of LAG and LACP I recommend [JeremysITLab](https://www.youtube.com/watch?v=xuo69Joy_Nc), and the Nokia documentation I followed can be found [here](https://documentation.nokia.com/srlinux/24-10/books/interfaces/lag.html).

### Topology

Today I'm using the existing topology from [lab number 2](/en/posts/lab-2-roas/). In short, the network consists of 3 host devices, one switch and one router, split into 3 VLANs, with routing done through the Router-on-a-Stick approach.

For this lab, the link between the router and the switch will be converted into a LAG. Instead of one physical link we'll have two, on ports `ethernet-1/1` and `ethernet-1/5`, and trunking will happen on the logical `lag1` interface.

<figure>
  <img src="/roas-lag.drawio.svg" alt="Topology of the ROAS over LAG lab: three Alpine clients (HOST10, HOST20, HOST30) in VLANs 10, 20 and 30 connected over access links to SW1, which is connected to router R1 over two physical links (e1/1 and e1/5) bundled into an 802.1Q trunk on lag1 (LACP)" class="w-full h-auto" />
  <figcaption class="text-center">Lab topology: the same ROAS, but the trunk between SW1 and R1 now consists of two physical links in lag1</figcaption>
</figure>

## Phase 2 – Initial configuration

To start, I'm using the saved config and `clab.yml` files from the [previous lab](/en/posts/lab-2-roas/). The links and hosts stay the same, and the only change for now is adding the second physical link between `sw1` and `r1` to `links`:

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

## Phase 3 – Configuring R1

I picked R1 as the first device to reconfigure. The first thing we do is create the `lag1` logical interface. The same lag interface configuration gets entered on SW1 later.

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

In order: `lag-type lacp` says the LAG uses LACP (rather than static aggregation), `min-links 1` keeps the LAG alive as long as at least one member is up, `lacp-mode ACTIVE` means this device sends LACPDU frames on its own, and `interval FAST` sends them every second (besides FAST there's also SLOW, which sends them every 30 seconds). I'll come back to `lacp-fallback-mode static` and `lacp-fallback-timeout 4` later, because at one point they got me into a "problem".

Next, on R1 we move the subinterfaces from `ethernet-1/1` to `lag1`, so instead of `ethernet-1/1.10`, `1/1.20` and `1/1.30` we now have `lag1.10`, `lag1.20` and `lag1.30`. We do this because `lag1` is now the logical unit that inter-VLAN routing happens on. Once a port becomes a LAG member, all L2/L3 configuration (VLAN tagging, IP addresses, subinterfaces, network instance membership) should be on `lag1`, not on the physical port.

For VLAN 10 it looks like this, and VLANs 20 and 30 are the same, just with a different ID and address:

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

After that, all that's left is to assign the physical interfaces `ethernet-1/1` and `ethernet-1/5` as members of lag group `lag1`. The same procedure is done on SW1.

```
set / interface ethernet-1/1 ethernet aggregate-id lag1
set / interface ethernet-1/1 ethernet lacp-port-priority 999
set / interface ethernet-1/5 ethernet aggregate-id lag1
set / interface ethernet-1/5 ethernet lacp-port-priority 1
commit now
```

To sum up R1: the `lag1.10/20/30` subinterfaces are `routed` with IP addresses and sit in `network-instance default`, while the physical ports (`ethernet-1/1`, `ethernet-1/5`) no longer have any subinterfaces or `vlan-tagging`, because we moved that over to `lag1`.

### Why is the LAG "up" when SW1 isn't configured yet?

I ran into something confusing here… After committing the changes on R1, with no configuration on SW1 at all, `lag1` on R1 showed as "up". How, if the lag on SW1 wasn't even configured yet?

After a short consultation with AI, I realized it happened because of the commands entered above: `lacp-fallback-mode static` and `lacp-fallback-timeout 4`. This effectively means that if LACP doesn't find a peer within 4 seconds, one of the LAG members becomes a static fallback interface and the LAG stays up without any LACP negotiation. In my case that also happened to line up with `lacp-port-priority 1` on `ethernet-1/5`, because the fallback picks the member with the best priority (lower number = higher priority).

I found the proof in the output of `info from state interface lag1 lag`:

- `partner-id 00:00:00:00:00:00`, `partner-port-num 0`
- `lacp-in-pkts 0` (not a single LACPDU received), while `lacp-out-pkts` keeps growing (R1 keeps sending LACPDUs without anyone answering the poor thing)
- `synchronization OUT_SYNC`, `collecting false`, `distributing false`
- and yet the member is `oper-state up`?

This means `oper-state up` on a LAG doesn't prove LACP works. For that, you look at the other fields listed above.

## Phase 4 – Configuring SW1

First we create the same `lag1` interface as on R1, with the same LAG settings. The only difference is that here we set the subinterfaces to `type bridged` instead of `type routed`, and without IP addresses, since the switch is at L2.

I made a mistake here: I simply pasted the flat `lag1` configuration from R1 onto SW1, so the IP addresses and the `routed` type came along with it. I had to fix that here.

```
set / interface lag1 admin-state enable
set / interface lag1 vlan-tagging true
set / interface lag1 subinterface 10 type bridged
set / interface lag1 subinterface 10 admin-state enable
set / interface lag1 subinterface 10 vlan encap single-tagged vlan-id 10
# same for subinterface 20 and 30, plus LAG settings identical to R1's

set / interface ethernet-1/1 ethernet aggregate-id lag1
set / interface ethernet-1/1 ethernet lacp-port-priority 999
set / interface ethernet-1/5 admin-state enable
set / interface ethernet-1/5 ethernet aggregate-id lag1
set / interface ethernet-1/5 ethernet lacp-port-priority 1
```

We then move the three `mac-vrf` network instances from the `ethernet-1/1.X` subinterfaces to `lag1.X`:

```
delete / network-instance vlan10 interface ethernet-1/1.10
set / network-instance vlan10 interface lag1.10
# same for vlan20 (lag1.20) and vlan30 (lag1.30)
commit now
```

## Phase 5 – LACP active

After the commit on both devices, LACP came up automatically very quickly. `interval FAST` (1s) made convergence very short.

What does a healthy LACP look like? These are some of the things we can see with `info from state interface lag1 lag` on R1:

- `partner-id` on R1 = `system-id` on SW1 and vice versa
- `synchronization IN_SYNC`, `collecting true`, `distributing true` on both members
- `lacp-in-pkts` is growing, errors are 0
- `lag-speed` jumped from 25000 (one member in fallback) to 50000 (2 × 25G)

## Phase 6 – Failure test

On R1 I shut down `ethernet-1/5` (`admin-state disable`). For that interface, `info from state interface lag1 lag` says `oper-down-reason port-disabled`, and on SW1 it says `port-oper-disabled`. The other, active member stayed `IN_SYNC`, and `lag-speed` dropped to 25000.

The LAG stayed up after one member was shut down, which means we achieved the redundancy we mentioned at the start of the lab.

## Phase 7 – "Packaging" for replication

As in the previous labs, I pulled the configurations of both devices into `.cli` files in the `/configs` subfolder (`r1.cli` and `sw1.cli`) and referenced them as `startup-config` in the topology.
By the way, it really annoys me that `info flat` on the device also contains things containerlab adds on its own (`system tls`, `network-instance mgmt`, `mgmt0`), so I have to be careful about what I copy into the config, because I don't want to leave anything unnecessary in. If there's a command that prints only the user-generated config, please let me know.

I also had AI rework the `verify.sh` script. The first version only checked pings, which is a problem here, because thanks to the fallback it would pass even with a broken LACP. The new version checks LACP first, and only then moves on to the gateway checks and inter-VLAN pings (TTL 64 to the gateway, 63 through R1).

You can find this lab at: [github.com/MilosGlamocak/network-labs](https://github.com/MilosGlamocak/network-labs/tree/master/basic/roas-lag).

> [!TIP] Key lessons from this lab
>
> - LACP doesn't create the LAG. I create the LAGs and add their members manually, on both sides. LACP only negotiates which members are active.
> - `lacp-fallback-mode static` can keep a LAG "up" even without an LACP partner, so `oper-state up` doesn't prove LACP works. That's why I have to look at the other fields: `partner-id`, `IN_SYNC` and `collecting`/`distributing`.
> - In fallback, the member with the lowest `lacp-port-priority` number stays active.
