// Настройки приёмника (ESP32 + E32-433T30D + Wi-Fi)
#pragma once

// ---- Wi-Fi ----
#define WIFI_SSID "New BilimLand Wi-Fi"  // регистр важен!
#define WIFI_PASSWORD "astana2023"
#define MDNS_NAME "alanatech-gps"  // http://alanatech-gps.local

// ---- E32-433T30D (UART2) ----
#define E32_RX_PIN 16   // <- TXD модуля E32
#define E32_TX_PIN 17   // -> RXD модуля E32
#define E32_M0_PIN 25
#define E32_M1_PIN 26
#define E32_AUX_PIN 27  // если AUX не подключён, тоже работает (вход с подтяжкой)

// Мощность E32 (0 = 30 дБм ... 3 = 21 дБм). Влияет только на передачу (env:tx_test).
#ifndef E32_POWER
#define E32_POWER 0
#endif

// TX_TEST=1 — приёмник сам шлёт "PING <n>" раз в 3 с: проверка эфира в обратную сторону.
#ifndef TX_TEST
#define TX_TEST 0
#endif

#define LED_PIN 2  // мигает при каждом принятом пакете

// Сколько последних точек хранить для трека на карте
#define HISTORY_SIZE 200

// Через сколько секунд без пакетов считать трекер "не в сети"
#define TRACKER_TIMEOUT_S 30
