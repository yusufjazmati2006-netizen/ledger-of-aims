"""Brings up the loopback interface inside a fresh network namespace (no `ip` needed).

Used by `npm run test:offline`, which runs the end-to-end suite under
`unshare -rn`: a namespace with no network at all except loopback, which Playwright
needs to talk to Electron. Any request the app made to the outside world would fail.
"""
import fcntl
import socket
import struct

SIOCSIFFLAGS = 0x8914
IFF_UP, IFF_LOOPBACK, IFF_RUNNING = 0x1, 0x8, 0x40

with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
    request = struct.pack("16sH14s", b"lo", IFF_UP | IFF_LOOPBACK | IFF_RUNNING, b"\0" * 14)
    fcntl.ioctl(s, SIOCSIFFLAGS, request)
