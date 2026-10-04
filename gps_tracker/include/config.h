// Настройки GPS-трекера (ESP32 + NEO-6M + E32-433T30D)
#pragma once

// Номер трекера (0..99) — у каждого трекера свой
#define DEVICE_ID 1

// Как часто отправлять координаты, мс
#define SEND_INTERVAL_MS 5000

// ---- NEO-6M (UART1) ----
#define GPS_RX_PIN 16  // <- TX модуля NEO-6M
#define GPS_TX_PIN 17  // -> RX модуля NEO-6M
#define GPS_BAUD 9600

// ---- E32-433T30D (UART2) ----
#define E32_RX_PIN 26   // <- TXD модуля E32
#define E32_TX_PIN 27   // -> RXD модуля E32
#define E32_M0_PIN 25
#define E32_M1_PIN 18
#ifndef E32_AUX_PIN
#define E32_AUX_PIN -1  // Плата-носитель: GPIO19 через env:carrier / carrier_fake.
#endif

// Мощность передачи E32: 0 = 30 дБм (1 Вт), 1 = 27 дБм, 2 = 24 дБм, 3 = 21 дБм.
// Для теста на столе (модули ближе 1-2 м) лучше 3 — на 1 Вт приёмник перегружается.
#ifndef E32_POWER
#define E32_POWER 0
#endif

#define LED_PIN 2  // встроенный светодиод

// FAKE_GPS=1 — вместо NEO-6M отправлять тестовые координаты (круг по Астане).
// Удобно для проверки радиоканала в помещении. Включается через env tracker_fake.
#ifndef FAKE_GPS
#define FAKE_GPS 0
#endif
