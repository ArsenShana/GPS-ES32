// Настройки приёмника (ESP32 + E32-433T30D + Wi-Fi)
#pragma once

// ---- Wi-Fi ----
#define WIFI_SSID "New BilimLand WI-FI"
#define WIFI_PASSWORD "astana2023"
#define MDNS_NAME "alanatech-gps"  // http://alanatech-gps.local

// ---- E32-433T30D (UART2) ----
#define E32_RX_PIN 26   // <- TXD модуля E32
#define E32_TX_PIN 27   // -> RXD модуля E32
#define E32_M0_PIN 25
#define E32_M1_PIN 18
#define E32_AUX_PIN -1  // -1, если AUX не подключён

#define LED_PIN 2  // мигает при каждом принятом пакете

// Сколько последних точек хранить для трека на карте
#define HISTORY_SIZE 200

// Через сколько секунд без пакетов считать трекер "не в сети"
#define TRACKER_TIMEOUT_S 30
