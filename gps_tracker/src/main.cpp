// GPS-трекер: читает NEO-6M и каждые SEND_INTERVAL_MS отправляет координаты через E32.
#include <Arduino.h>
#include <TinyGPSPlus.h>
#include <math.h>

#include "E32.h"
#include "GpsProtocol.h"
#include "config.h"

static TinyGPSPlus gps;
static HardwareSerial gpsSerial(1);
static E32 lora(Serial2, E32_RX_PIN, E32_TX_PIN, E32_M0_PIN, E32_M1_PIN, E32_AUX_PIN);

static uint16_t seq = 0;
static uint32_t lastSendMs = 0;
static bool loraOk = false;

static void printConfig(const E32::Config& c) {
  Serial.printf("[E32] ADDH=%02X ADDL=%02X SPED=%02X CHAN=%02X (%u MHz) OPTION=%02X\n", c.addh,
                c.addl, c.sped, c.chan, 410 + c.chan, c.option);
}

static gpsproto::Packet makePacket() {
  gpsproto::Packet p;
  p.deviceId = DEVICE_ID;
  p.seq = seq;
#if FAKE_GPS
  // Круг радиусом ~500 м вокруг центра Астаны, один оборот за 5 минут.
  float a = (millis() % 300000UL) / 300000.0f * 2.0f * (float)M_PI;
  p.fix = true;
  p.lat = 51.128207 + 0.0045 * sin(a);
  p.lon = 71.430411 + 0.0072 * cos(a);
  p.altM = 347;
  p.speedKmh = 37.7f;
  p.sats = 9;
  p.hdop = 0.9f;
#else
  p.fix = gps.location.isValid() && gps.location.age() < 3000;
  if (gps.location.isValid()) {  // последняя известная точка, даже если фикс потерян
    p.lat = gps.location.lat();
    p.lon = gps.location.lng();
  }
  if (gps.altitude.isValid()) p.altM = (int16_t)lround(gps.altitude.meters());
  if (gps.speed.isValid()) p.speedKmh = (float)gps.speed.kmph();
  if (gps.satellites.isValid()) p.sats = (uint8_t)min<uint32_t>(gps.satellites.value(), 99);
  p.hdop = gps.hdop.isValid() ? (float)gps.hdop.hdop() : 99.9f;
#endif
  return p;
}

static void sendPacket() {
  char buf[gpsproto::kBufferSize];
  gpsproto::Packet p = makePacket();
  int n = gpsproto::encode(p, buf, sizeof(buf));
  if (n < 0) {
    Serial.println("[TX] ошибка кодирования пакета");
    return;
  }
  if (!lora.waitAux(2000)) Serial.println("[TX] E32 занят (AUX=LOW), отправляю всё равно");

  digitalWrite(LED_PIN, HIGH);
  lora.serial().write((const uint8_t*)buf, n);
  lora.serial().flush();
  digitalWrite(LED_PIN, LOW);

  Serial.printf("[TX] %.*s", n, buf);  // buf уже содержит '\n'
  seq++;
}

static void printGpsStatus() {
#if !FAKE_GPS
  Serial.printf("[GPS] символов=%lu, NMEA ок=%lu, ошибок CRC=%lu, спутников=%lu, фикс=%s\n",
                (unsigned long)gps.charsProcessed(), (unsigned long)gps.passedChecksum(),
                (unsigned long)gps.failedChecksum(),
                (unsigned long)(gps.satellites.isValid() ? gps.satellites.value() : 0),
                gps.location.isValid() ? "да" : "нет");
  if (millis() > 5000 && gps.charsProcessed() < 10) {
    Serial.println("[GPS] !!! нет данных от NEO-6M — проверьте питание и провод TX модуля -> GPIO"
                   " " + String(GPS_RX_PIN));
  }
#endif
}

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(LED_PIN, OUTPUT);
  Serial.println();
  Serial.printf("=== AlanaTech GPS трекер, ID=%d%s ===\n", DEVICE_ID,
                FAKE_GPS ? " (ТЕСТОВЫЕ КООРДИНАТЫ)" : "");

  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  loraOk = lora.begin();
  if (!loraOk) {
    Serial.println("[E32] !!! модуль не отвечает (AUX не поднялся). Проверьте питание 5 В и M0/M1/AUX");
  }
  E32::Config actual{};
  if (lora.ensureConfig(E32::defaultConfig(E32_POWER), &actual)) {
    Serial.println("[E32] конфигурация ОК");
    printConfig(actual);
  } else {
    Serial.println("[E32] !!! не удалось прочитать/записать конфигурацию. Проверьте RX/TX провода");
    loraOk = false;
  }
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());

  // Всё, что пришло по радио, просто печатаем (на будущее — команды от приёмника).
  while (lora.serial().available()) Serial.write(lora.serial().read());

  uint32_t now = millis();
  if (now - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = now;
    printGpsStatus();
    sendPacket();
  }
}
