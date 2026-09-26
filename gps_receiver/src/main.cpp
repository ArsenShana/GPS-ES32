// Приёмник: принимает пакеты от GPS-трекера через E32 и показывает их по Wi-Fi.
//   http://<IP>/            — карта и таблица
//   http://<IP>/api/last    — последний пакет (JSON)
//   http://<IP>/api/history — трек [[lat,lon],...] (JSON)
//   http://<IP>/api/status  — статистика приёма и Wi-Fi (JSON)
#include <Arduino.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <WiFi.h>

#include "E32.h"
#include "GpsProtocol.h"
#include "config.h"
#include "web_page.h"

static E32 lora(Serial2, E32_RX_PIN, E32_TX_PIN, E32_M0_PIN, E32_M1_PIN, E32_AUX_PIN);
static WebServer server(80);
static bool loraOk = false;

// ---- состояние приёма ----
static gpsproto::Packet last;
static bool hasLast = false;
static uint32_t lastRxMs = 0;
static uint32_t rxOk = 0, rxBad = 0, rxLost = 0;
static int32_t lastSeqById[100];  // -1 = ещё не видели

struct Point {
  float lat, lon;
};
static Point history[HISTORY_SIZE];
static size_t historyLen = 0, historyHead = 0;

static char line[96];
static size_t lineLen = 0;
static uint32_t lineLastByteMs = 0;

// ---------------------------------------------------------------------------

static void onPacket(const gpsproto::Packet& p) {
  rxOk++;
  int32_t& prev = lastSeqById[p.deviceId];
  if (prev >= 0 && p.seq != (uint16_t)prev) {
    uint16_t lost = gpsproto::lostBetween((uint16_t)prev, p.seq);
    if (lost < 1000) rxLost += lost;  // большой скачок = трекер перезагрузился
  }
  prev = p.seq;

  last = p;
  hasLast = true;
  lastRxMs = millis();

  if (p.fix) {
    history[historyHead] = {(float)p.lat, (float)p.lon};
    historyHead = (historyHead + 1) % HISTORY_SIZE;
    if (historyLen < HISTORY_SIZE) historyLen++;
  }

  Serial.printf("[RX] id=%u seq=%u fix=%d lat=%.6f lon=%.6f alt=%d м скорость=%.1f км/ч спутн=%u "
                "hdop=%.1f | ок=%lu плохих=%lu потеряно=%lu\n",
                p.deviceId, p.seq, p.fix, p.lat, p.lon, p.altM, p.speedKmh, p.sats, p.hdop,
                (unsigned long)rxOk, (unsigned long)rxBad, (unsigned long)rxLost);
}

static void onLine() {
  line[lineLen] = 0;
  gpsproto::Packet p;
  if (gpsproto::decode(line, p)) {
    onPacket(p);
  } else if (lineLen > 0) {
    rxBad++;
    Serial.printf("[RX] плохой пакет (%u байт): %s\n", (unsigned)lineLen, line);
  }
  lineLen = 0;
}

static void pollLora() {
  while (lora.serial().available()) {
    char c = (char)lora.serial().read();
    lineLastByteMs = millis();
    if (c == '\n') {
      digitalWrite(LED_PIN, HIGH);
      onLine();
      digitalWrite(LED_PIN, LOW);
    } else if (c != '\r') {
      if (lineLen < sizeof(line) - 1) {
        line[lineLen++] = c;
      } else {  // слишком длинная строка — мусор
        rxBad++;
        lineLen = 0;
      }
    }
  }
  // обрывок пакета без '\n' — выбрасываем через 1 с
  if (lineLen > 0 && millis() - lineLastByteMs > 1000) onLine();
}

// ---- HTTP ------------------------------------------------------------------

static void sendJson(const String& body) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", body);
}

static void handleLast() {
  if (!hasLast) {
    sendJson("{\"has_data\":false}");
    return;
  }
  char buf[320];
  snprintf(buf, sizeof(buf),
           "{\"has_data\":true,\"id\":%u,\"seq\":%u,\"fix\":%s,\"lat\":%.6f,\"lon\":%.6f,"
           "\"alt\":%d,\"speed\":%.1f,\"sats\":%u,\"hdop\":%.1f,\"age_s\":%lu,\"online\":%s}",
           last.deviceId, last.seq, last.fix ? "true" : "false", last.lat, last.lon, last.altM,
           last.speedKmh, last.sats, last.hdop, (unsigned long)((millis() - lastRxMs) / 1000),
           millis() - lastRxMs < TRACKER_TIMEOUT_S * 1000UL ? "true" : "false");
  sendJson(buf);
}

static void handleHistory() {
  String s;
  s.reserve(historyLen * 24 + 4);
  s += '[';
  size_t start = (historyHead + HISTORY_SIZE - historyLen) % HISTORY_SIZE;
  char buf[32];
  for (size_t i = 0; i < historyLen; i++) {
    const Point& pt = history[(start + i) % HISTORY_SIZE];
    snprintf(buf, sizeof(buf), "%s[%.6f,%.6f]", i ? "," : "", pt.lat, pt.lon);
    s += buf;
  }
  s += ']';
  sendJson(s);
}

static void handleStatus() {
  char buf[320];
  snprintf(buf, sizeof(buf),
           "{\"uptime_s\":%lu,\"lora_ok\":%s,\"rx_ok\":%lu,\"rx_bad\":%lu,\"rx_lost\":%lu,"
           "\"wifi_rssi\":%d,\"ip\":\"%s\",\"free_heap\":%lu}",
           (unsigned long)(millis() / 1000), loraOk ? "true" : "false", (unsigned long)rxOk,
           (unsigned long)rxBad, (unsigned long)rxLost, WiFi.RSSI(),
           WiFi.localIP().toString().c_str(), (unsigned long)ESP.getFreeHeap());
  sendJson(buf);
}

static void handleReset() {
  rxOk = rxBad = rxLost = 0;
  historyLen = historyHead = 0;
  for (auto& s : lastSeqById) s = -1;
  sendJson("{\"ok\":true}");
}

// ---- Wi-Fi -----------------------------------------------------------------

static void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setHostname(MDNS_NAME);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WiFi] подключение к \"%s\"", WIFI_SSID);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WiFi] подключено, IP: %s, RSSI: %d дБм\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("[WiFi] !!! не удалось подключиться, продолжаю попытки в фоне");
  }
}

static void pollWifi() {
  static bool wasConnected = false;
  static uint32_t lastTry = 0;
  bool c = WiFi.status() == WL_CONNECTED;
  if (c && !wasConnected) {
    Serial.printf("[WiFi] подключено, IP: %s — откройте http://%s/ или http://%s.local/\n",
                  WiFi.localIP().toString().c_str(), WiFi.localIP().toString().c_str(), MDNS_NAME);
  } else if (!c && wasConnected) {
    Serial.println("[WiFi] соединение потеряно");
  }
  if (!c && millis() - lastTry > 15000) {
    lastTry = millis();
    WiFi.reconnect();
  }
  wasConnected = c;
}

// ---------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(LED_PIN, OUTPUT);
  for (auto& s : lastSeqById) s = -1;
  Serial.println();
  Serial.println("=== AlanaTech GPS приёмник ===");

  loraOk = lora.begin();
  if (!loraOk) {
    Serial.println("[E32] !!! модуль не отвечает (AUX не поднялся). Проверьте питание 5 В и M0/M1/AUX");
  }
  E32::Config actual{};
  if (lora.ensureConfig(E32::defaultConfig(), &actual)) {
    Serial.printf("[E32] конфигурация ОК: ADDH=%02X ADDL=%02X SPED=%02X CHAN=%02X (%u МГц) OPTION=%02X\n",
                  actual.addh, actual.addl, actual.sped, actual.chan, 410 + actual.chan,
                  actual.option);
  } else {
    Serial.println("[E32] !!! не удалось прочитать/записать конфигурацию. Проверьте RX/TX провода");
    loraOk = false;
  }

  connectWifi();
  if (MDNS.begin(MDNS_NAME)) MDNS.addService("http", "tcp", 80);

  server.on("/", [] { server.send_P(200, "text/html; charset=utf-8", WEB_PAGE); });
  server.on("/api/last", handleLast);
  server.on("/api/history", handleHistory);
  server.on("/api/status", handleStatus);
  server.on("/api/reset", HTTP_POST, handleReset);
  server.onNotFound([] { server.send(404, "text/plain", "not found"); });
  server.begin();
  Serial.println("[HTTP] сервер запущен, жду пакеты от трекера...");
}

void loop() {
  pollLora();
  pollWifi();
  server.handleClient();

  static uint32_t lastWarn = 0;
  if (millis() - lastWarn > 30000) {
    lastWarn = millis();
    if (!hasLast) {
      Serial.println("[RX] пакетов пока нет. Трекер включён? Одинаковый канал/адрес на обоих E32?");
    } else if (millis() - lastRxMs > TRACKER_TIMEOUT_S * 1000UL) {
      Serial.printf("[RX] нет пакетов уже %lu с\n", (unsigned long)((millis() - lastRxMs) / 1000));
    }
  }
}
