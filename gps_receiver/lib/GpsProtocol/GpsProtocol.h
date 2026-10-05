// Протокол пакета GPS для передачи через E32 (LoRa, прозрачный режим).
// ВАЖНО: этот файл одинаковый в gps_tracker и gps_receiver — меняйте оба.
//
// Формат строки (ASCII, заканчивается '\n'):
//   G,<id>,<seq>,<fix>,<lat>,<lon>,<alt>,<speed>,<sats>,<hdop>*HH\n
//   id    — номер трекера 0..99
//   seq   — счётчик пакетов 0..65535 (для подсчёта потерь)
//   fix   — 1 = координаты валидны, 0 = нет фикса
//   lat   — широта, градусы, 6 знаков
//   lon   — долгота, градусы, 6 знаков
//   alt   — высота, метры (целое, -999..9999)
//   speed — скорость, км/ч (0..999.9)
//   sats  — количество спутников 0..99
//   hdop  — HDOP 0..99.9
//   HH    — XOR всех символов до '*' (hex)
//
// Максимальная длина — 58 байт, это ровно один подпакет E32,
// поэтому пакет уходит в эфир одним куском.
#pragma once

#include <ctype.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

namespace gpsproto {

constexpr size_t kMaxPacketLen = 58;  // включая '\n'
constexpr size_t kBufferSize = 64;

struct Packet {
  uint8_t deviceId = 0;
  uint16_t seq = 0;
  bool fix = false;
  double lat = 0;
  double lon = 0;
  int16_t altM = 0;
  float speedKmh = 0;
  uint8_t sats = 0;
  float hdop = 0;
};

inline uint8_t checksum(const char* s, size_t n) {
  uint8_t c = 0;
  for (size_t i = 0; i < n; i++) c ^= (uint8_t)s[i];
  return c;
}

template <typename T>
inline T clampv(T v, T lo, T hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// Возвращает длину строки (включая '\n') или -1 при ошибке.
inline int encode(const Packet& p, char* out, size_t cap) {
  if (cap < kBufferSize) return -1;
  int n = snprintf(out, cap, "G,%u,%u,%d,%.6f,%.6f,%d,%.1f,%u,%.1f",
                   (unsigned)clampv<uint8_t>(p.deviceId, 0, 99), (unsigned)p.seq,
                   p.fix ? 1 : 0, clampv(p.lat, -90.0, 90.0),
                   clampv(p.lon, -180.0, 180.0),
                   (int)clampv<int16_t>(p.altM, -999, 9999),
                   (double)clampv(p.speedKmh, 0.0f, 999.9f),
                   (unsigned)clampv<uint8_t>(p.sats, 0, 99),
                   (double)clampv(p.hdop, 0.0f, 99.9f));
  if (n < 0 || (size_t)n + 4 > kMaxPacketLen) return -1;
  n += snprintf(out + n, cap - (size_t)n, "*%02X\n", checksum(out, (size_t)n));
  return n;
}

namespace detail {

inline bool parseLong(const char* s, long lo, long hi, long& out) {
  if (!*s) return false;
  char* end;
  long v = strtol(s, &end, 10);
  if (*end || v < lo || v > hi) return false;
  out = v;
  return true;
}

inline bool parseDouble(const char* s, double lo, double hi, double& out) {
  if (!*s) return false;
  char* end;
  double v = strtod(s, &end);
  if (*end || !(v >= lo && v <= hi)) return false;
  out = v;
  return true;
}

}  // namespace detail

// Разбирает одну строку (с '\n', '\r' в конце или без). true — пакет валиден.
inline bool decode(const char* line, Packet& p) {
  if (strncmp(line, "G,", 2) != 0) return false;
  const char* star = strchr(line, '*');
  if (!star) return false;
  size_t body = (size_t)(star - line);
  if (body + 4 > kMaxPacketLen) return false;

  if (!isxdigit((unsigned char)star[1]) || !isxdigit((unsigned char)star[2])) return false;
  for (const char* t = star + 3; *t; t++) {
    if (*t != '\r' && *t != '\n') return false;
  }
  char hex[3] = {star[1], star[2], 0};
  if ((uint8_t)strtoul(hex, nullptr, 16) != checksum(line, body)) return false;

  char buf[kBufferSize];
  memcpy(buf, line + 2, body - 2);
  buf[body - 2] = 0;

  const char* f[9];
  int cnt = 0;
  f[cnt++] = buf;
  for (char* s = buf; *s; s++) {
    if (*s == ',') {
      if (cnt >= 9) return false;
      *s = 0;
      f[cnt++] = s + 1;
    }
  }
  if (cnt != 9) return false;

  long id, seq, fix, alt, sats;
  double lat, lon, spd, hdop;
  using namespace detail;
  if (!parseLong(f[0], 0, 99, id) || !parseLong(f[1], 0, 65535, seq) ||
      !parseLong(f[2], 0, 1, fix) || !parseDouble(f[3], -90, 90, lat) ||
      !parseDouble(f[4], -180, 180, lon) || !parseLong(f[5], -999, 9999, alt) ||
      !parseDouble(f[6], 0, 999.9, spd) || !parseLong(f[7], 0, 99, sats) ||
      !parseDouble(f[8], 0, 99.9, hdop)) {
    return false;
  }

  p.deviceId = (uint8_t)id;
  p.seq = (uint16_t)seq;
  p.fix = fix == 1;
  p.lat = lat;
  p.lon = lon;
  p.altM = (int16_t)alt;
  p.speedKmh = (float)spd;
  p.sats = (uint8_t)sats;
  p.hdop = (float)hdop;
  return true;
}

// Сколько пакетов потеряно между двумя последовательными seq (с учётом переполнения).
inline uint16_t lostBetween(uint16_t prevSeq, uint16_t seq) {
  return (uint16_t)(seq - prevSeq - 1);
}

}  // namespace gpsproto
