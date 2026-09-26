// Минимальный драйвер модуля EBYTE E32-433T30D (UART LoRa).
// ВАЖНО: этот файл одинаковый в gps_tracker и gps_receiver — меняйте оба.
#pragma once

#include <Arduino.h>

class E32 {
 public:
  enum class Mode : uint8_t { Normal = 0, WakeUp = 1, PowerSave = 2, Sleep = 3 };

  // Параметры модуля (5 байт после заголовка C0/C2).
  struct Config {
    uint8_t addh;
    uint8_t addl;
    uint8_t sped;
    uint8_t chan;
    uint8_t option;
    bool operator==(const Config& o) const {
      return addh == o.addh && addl == o.addl && sped == o.sped && chan == o.chan &&
             option == o.option;
    }
  };

  // 433 МГц (410 + 0x17), адрес 0x0000, UART 9600 8N1, эфир 2.4 кбит/с,
  // прозрачный режим, push-pull, FEC вкл, мощность 30 дБм (1 Вт).
  static Config defaultConfig() { return {0x00, 0x00, 0x1A, 0x17, 0x44}; }

  E32(HardwareSerial& serial, int8_t rxPin, int8_t txPin, int8_t m0Pin, int8_t m1Pin,
      int8_t auxPin)
      : serial_(serial), rx_(rxPin), tx_(txPin), m0_(m0Pin), m1_(m1Pin), aux_(auxPin) {}

  // Инициализация пинов и UART, модуль переводится в Normal.
  // Возвращает false, если модуль не ответил (AUX не поднялся).
  bool begin() {
    pinMode(m0_, OUTPUT);
    pinMode(m1_, OUTPUT);
    if (aux_ >= 0) pinMode(aux_, INPUT_PULLUP);
    serial_.begin(9600, SERIAL_8N1, rx_, tx_);
    return setMode(Mode::Normal);
  }

  bool setMode(Mode m) {
    uint8_t v = (uint8_t)m;
    digitalWrite(m0_, v & 1 ? HIGH : LOW);
    digitalWrite(m1_, v & 2 ? HIGH : LOW);
    delay(10);
    bool ok = waitAux(1000);
    delay(20);  // по даташиту: после AUX=HIGH ещё ~2 мс до готовности
    return ok;
  }

  // AUX = HIGH — модуль свободен (буфер передачи пуст).
  bool waitAux(uint32_t timeoutMs) {
    if (aux_ < 0) {
      delay(50);
      return true;
    }
    uint32_t start = millis();
    while (digitalRead(aux_) == LOW) {
      if (millis() - start > timeoutMs) return false;
      delay(1);
    }
    return true;
  }

  bool isBusy() const { return aux_ >= 0 && digitalRead(aux_) == LOW; }

  bool readConfig(Config& out) {
    if (!setMode(Mode::Sleep)) return false;
    drain();
    const uint8_t cmd[3] = {0xC1, 0xC1, 0xC1};
    serial_.write(cmd, 3);
    uint8_t resp[6];
    bool ok = readBytes(resp, 6, 500) && (resp[0] == 0xC0 || resp[0] == 0xC2);
    if (ok) out = {resp[1], resp[2], resp[3], resp[4], resp[5]};
    setMode(Mode::Normal);
    return ok;
  }

  // Записывает конфиг во flash модуля (C0), только если он отличается от текущего.
  // Возвращает true, если после операции конфиг модуля совпадает с нужным.
  bool ensureConfig(const Config& want, Config* actual = nullptr) {
    Config cur{};
    if (readConfig(cur) && cur == want) {
      if (actual) *actual = cur;
      return true;
    }
    if (!setMode(Mode::Sleep)) return false;
    drain();
    const uint8_t cmd[6] = {0xC0, want.addh, want.addl, want.sped, want.chan, want.option};
    serial_.write(cmd, 6);
    uint8_t resp[6];
    readBytes(resp, 6, 500);  // модуль эхом возвращает записанные параметры
    setMode(Mode::Normal);
    if (!readConfig(cur)) return false;
    if (actual) *actual = cur;
    return cur == want;
  }

  HardwareSerial& serial() { return serial_; }

 private:
  void drain() {
    while (serial_.available()) serial_.read();
  }

  bool readBytes(uint8_t* buf, size_t n, uint32_t timeoutMs) {
    uint32_t start = millis();
    size_t got = 0;
    while (got < n && millis() - start < timeoutMs) {
      if (serial_.available()) buf[got++] = (uint8_t)serial_.read();
    }
    return got == n;
  }

  HardwareSerial& serial_;
  int8_t rx_, tx_, m0_, m1_, aux_;
};
