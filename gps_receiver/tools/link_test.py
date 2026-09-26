"""Проверка связи трекер -> приёмник через HTTP API приёмника.

Запуск (ПК в той же Wi-Fi сети):
    python link_test.py 192.168.1.50            # 60 секунд
    python link_test.py alanatech-gps.local -t 300

Опрашивает /api/last и /api/status, печатает каждый новый пакет и в конце
выдаёт итог: сколько принято, потеряно, % потерь, был ли GPS фикс.
Код выхода 0 — связь есть, 1 — нет пакетов или потери > 20%.
Только стандартная библиотека Python.
"""
import argparse
import json
import sys
import time
import urllib.request


def get(host, path):
    with urllib.request.urlopen(f"http://{host}{path}", timeout=5) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("host", help="IP или имя приёмника")
    ap.add_argument("-t", "--time", type=int, default=60, help="длительность теста, с")
    ap.add_argument("--no-reset", action="store_true", help="не сбрасывать статистику перед тестом")
    args = ap.parse_args()

    try:
        st = get(args.host, "/api/status")
    except Exception as e:
        print(f"ОШИБКА: приёмник {args.host} недоступен: {e}")
        return 1
    print(f"Приёмник на связи: IP {st['ip']}, Wi-Fi {st['wifi_rssi']} дБм, E32 {'OK' if st['lora_ok'] else 'ОШИБКА'}")
    if not st["lora_ok"]:
        print("ВНИМАНИЕ: приёмник сообщает, что модуль E32 не настроен — смотрите Serial-лог")

    if not args.no_reset:
        req = urllib.request.Request(f"http://{args.host}/api/reset", method="POST")
        urllib.request.urlopen(req, timeout=5).read()

    print(f"Слушаю {args.time} с...\n")
    last_seq = None
    fixes = 0
    end = time.time() + args.time
    while time.time() < end:
        try:
            d = get(args.host, "/api/last")
        except Exception as e:
            print(f"  (ошибка запроса: {e})")
            time.sleep(2)
            continue
        if d.get("has_data") and d["seq"] != last_seq and d["age_s"] < 10:
            last_seq = d["seq"]
            fixes += d["fix"]
            print(f"  #{d['seq']:<5} fix={int(d['fix'])} {d['lat']:.6f},{d['lon']:.6f} "
                  f"спутн={d['sats']} hdop={d['hdop']} скор={d['speed']} км/ч")
        time.sleep(1)

    st = get(args.host, "/api/status")
    ok, lost, bad = st["rx_ok"], st["rx_lost"], st["rx_bad"]
    total = ok + lost
    loss = 100.0 * lost / total if total else 100.0
    print("\n===== ИТОГ =====")
    print(f"Принято: {ok}, потеряно: {lost} ({loss:.1f}%), битых: {bad}, с GPS фиксом: {fixes}")
    if ok == 0:
        print("ПРОВАЛ: ни одного пакета. Проверьте питание трекера, антенны и одинаковый канал E32.")
        return 1
    if loss > 20:
        print("ПЛОХО: потерь больше 20%. Проверьте антенны, питание 5 В (E32 1 Вт требует ток до 700 мА).")
        return 1
    if fixes == 0:
        print("РАДИОКАНАЛ OK, но GPS фикса нет — вынесите NEO-6M на улицу/к окну (холодный старт до 5 мин).")
    else:
        print("ВСЁ OK: радиоканал и GPS работают.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
