// Настройки GPS-трекера (ESP32 + NEO-6M + E32-433T30D)
#pragma once

// Номер трекера (0..99) — у каждого трекера свой
#define DEVICE_ID 1

// Как часто отправлять координаты, мс
#define SEND_INTERVAL_MS 5000

// ---- NEO-6M (UART1) ----
#define GPS_RX_PIN 32  // <- TX модуля NEO-6M
#define GPS_TX_PIN 33  // -> RX модуля NEO-6M
#define GPS_BAUD 9600

// ---- E32-433T30D (UART2) ----
#define E32_RX_PIN 16   // <- TXD модуля E32
#define E32_TX_PIN 17   // -> RXD модуля E32
#define E32_M0_PIN 25
#define E32_M1_PIN 26
#define E32_AUX_PIN 27  // -1, если AUX не подключён

#define LED_PIN 2  // встроенный светодиод

// FAKE_GPS=1 — вместо NEO-6M отправлять тестовые координаты (круг по Астане).
// Удобно для проверки радиоканала в помещении. Включается через env tracker_fake.
#ifndef FAKE_GPS
#define FAKE_GPS 0
#endif
