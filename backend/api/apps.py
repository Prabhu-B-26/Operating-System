from django.apps import AppConfig
import threading
import time
import random
import os
import sys
import logging


logger = logging.getLogger(__name__)
_SCHEDULER_STARTED = False

# --- Global RAM simulation ---
# 8 frames of physical RAM; each entry is either None or { 'pid': int, 'v_page': int }
PHYSICAL_RAM_FRAMES = [None] * 8
# Reverse lookup / metadata (not strictly required but kept for completeness)
FRAME_TABLE = {}
# Last scheduler event text (e.g., page fault) for UI
LAST_EVENT = None


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        global _SCHEDULER_STARTED

        # Start only once in the reloader child process when using runserver
        is_runserver = any(cmd in sys.argv for cmd in ['runserver', 'runserver_plus'])
        is_reloader_child = os.environ.get('RUN_MAIN') == 'true'
        if not (is_runserver and is_reloader_child):
            return

        if _SCHEDULER_STARTED:
            return
        _SCHEDULER_STARTED = True

        from django.db import connection
        from .models import Process, FileSystemObject

        def scheduler_loop():
            logger.info('Process scheduler thread started (FCFS).')
            while True:
                try:
                    # Ensure DB connection is usable in this thread
                    try:
                        connection.close_if_unusable_or_obsolete()
                    except Exception:
                        pass

                    # FCFS: pick the oldest Ready process
                    proc = (
                        Process.objects
                        .filter(status='Ready')
                        .order_by('created_at', 'id')
                        .first()
                    )
                    if not proc:
                        time.sleep(2)
                        continue

                    # Attempt to claim the process atomically by status
                    claimed = (
                        Process.objects
                        .filter(id=proc.id, status='Ready')
                        .update(status='Running')
                    )
                    if claimed == 0:
                        # Lost the race, try again
                        continue

                    logger.debug('Running PID %s (%s)', proc.id, proc.file_object_id)

                    # Slow down demo: simulate CPU work while in Running state
                    time.sleep(15)

                    # Load file content to simulate virtual memory (1 line = 1 virtual page)
                    try:
                        fso = FileSystemObject.objects.get(id=proc.file_object_id, owner=proc.owner, is_directory=False)
                        # Exec permission check: expect 'x' at index 2
                        perms = (fso.permissions or '')
                        if len(perms) >= 3 and perms[2] != 'x':
                            msg = f"[Scheduler] Exec denied for PID {proc.id}: file not executable"
                            logger.info(msg)
                            globals()['LAST_EVENT'] = msg
                            Process.objects.filter(id=proc.id).update(status='Finished')
                            continue
                        content = fso.content or ''
                    except FileSystemObject.DoesNotExist:
                        content = ''
                    lines = content.split('\n') if content else []

                    # Work through each virtual page sequentially
                    page_table = dict(proc.page_table or {})
                    for v_idx, _ in enumerate(lines):
                        vkey = f"v_page_{v_idx}"
                        # Check if mapped
                        mapped = page_table.get(vkey)
                        if not mapped:
                            # Page fault
                            try:
                                Process.objects.filter(id=proc.id).update(status='Blocked')
                            except Exception:
                                pass
                            msg = f"[Scheduler] Page Fault for PID {proc.id}, VPage {v_idx}!" 
                            logger.info(msg)
                            globals()['LAST_EVENT'] = msg
                            # Simulate disk load (slower for demo)
                            time.sleep(5)
                            # Find a free frame
                            frame_idx = None
                            for idx, ent in enumerate(PHYSICAL_RAM_FRAMES):
                                if ent is None:
                                    frame_idx = idx
                                    break
                            if frame_idx is None:
                                # Simple eviction: evict frame 0
                                evicted = PHYSICAL_RAM_FRAMES[0]
                                if evicted is not None:
                                    try:
                                        ev_pid = evicted['pid']
                                        ev_vpage = evicted['v_page']
                                        ev_proc = Process.objects.filter(id=ev_pid).first()
                                        if ev_proc:
                                            ev_pt = dict(ev_proc.page_table or {})
                                            ev_key = f"v_page_{ev_vpage}"
                                            if ev_key in ev_pt and ev_pt[ev_key] == 'p_frame_0':
                                                ev_pt.pop(ev_key, None)
                                                Process.objects.filter(id=ev_pid).update(page_table=ev_pt)
                                    except Exception:
                                        pass
                                frame_idx = 0
                            # Map and load
                            PHYSICAL_RAM_FRAMES[frame_idx] = { 'pid': proc.id, 'v_page': v_idx }
                            FRAME_TABLE[f"p_frame_{frame_idx}"] = { 'pid': proc.id, 'v_page': v_idx }
                            page_table[vkey] = f"p_frame_{frame_idx}"
                            Process.objects.filter(id=proc.id).update(page_table=page_table)
                            # Ready again
                            Process.objects.filter(id=proc.id).update(status='Ready')
                        else:
                            # Memory hit
                            msg = f"[Scheduler] Memory hit for PID {proc.id}, VPage {v_idx}."
                            logger.debug(msg)
                            globals()['LAST_EVENT'] = msg
                            # Simulate brief CPU time per page hit
                            time.sleep(0.5)

                    # After all pages accessed, mark as finished
                    Process.objects.filter(id=proc.id).update(status='Finished')
                    try:
                        # Free all physical frames used by this process
                        # Refetch latest page_table from DB to be safe
                        latest_pt = (
                            Process.objects.filter(id=proc.id)
                            .values_list('page_table', flat=True)
                            .first()
                        ) or {}
                        if isinstance(latest_pt, dict):
                            for vkey, pframe in list(latest_pt.items()):
                                try:
                                    if isinstance(pframe, str) and pframe.startswith('p_frame_'):
                                        idx_str = pframe.split('_')[-1]
                                        idx = int(idx_str)
                                        if 0 <= idx < len(PHYSICAL_RAM_FRAMES):
                                            PHYSICAL_RAM_FRAMES[idx] = None
                                        FRAME_TABLE.pop(pframe, None)
                                except Exception:
                                    # Ignore malformed entries
                                    pass
                            # Clear page table in DB
                            Process.objects.filter(id=proc.id).update(page_table={})
                    except Exception:
                        # Do not let cleanup errors crash the scheduler
                        logger.exception('Error freeing frames for PID %s', proc.id)
                    logger.debug('Finished PID %s', proc.id)

                except Exception as e:
                    logger.exception('Scheduler loop error: %s', e)
                    time.sleep(2)

        t = threading.Thread(target=scheduler_loop, name='ProcessScheduler', daemon=True)
        t.start()
