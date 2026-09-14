# Flex release registry

This branch stores shared release identity for every Flex source branch.
Read releases/registry.json before allocating or delivering a version.
Records are append-only. Do not reset, merge, or develop application source here.
The latest release record's gitSha identifies the latest delivered source.

Legacy version identifiers through 0.9.2 / 902 are permanently closed.
New records are written by the verified build's release:register command using
the Contents API blob SHA for an atomic compare-and-swap.
