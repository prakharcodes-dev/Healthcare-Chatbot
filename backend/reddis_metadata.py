"""Best-effort Reddis writes for non-clinical session metadata only."""
import json
import logging
import os
import socket

logger = logging.getLogger(__name__)


def save_session_metadata(session_id, status, message_count, started_at=None):
    # Never pass symptoms, measurements, user IDs, or chat messages to this helper.
    record = {
        "project": "healthcare-chatbot",
        "sessionId": session_id,
        "status": status,
        "messageCount": int(message_count),
        "startedAt": started_at,
    }
    host = os.getenv("REDDIS_HOST", "127.0.0.1")
    try:
        port = int(os.getenv("REDDIS_PORT", "6379"))
        args = [b"SET", ("healthcare:session:" + session_id).encode("utf-8"),
                json.dumps(record, separators=(",", ":")).encode("utf-8")]
        request = b"*3\r\n" + b"".join(
            b"$" + str(len(arg)).encode("ascii") + b"\r\n" + arg + b"\r\n" for arg in args
        )
        with socket.create_connection((host, port), timeout=0.35) as conn:
            conn.settimeout(0.35)
            conn.sendall(request)
            reply = bytearray()
            while not reply.endswith(b"\r\n"):
                part = conn.recv(1)
                if not part:
                    raise OSError("Reddis closed the connection")
                reply.extend(part)
            if reply != b"+OK\r\n":
                raise OSError("Reddis did not confirm the write")
        return True
    except (OSError, ValueError) as exc:
        logger.debug("Reddis session metadata write skipped: %s", exc)
        return False
