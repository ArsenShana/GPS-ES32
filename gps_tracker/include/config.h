// Настройки GPS-трекера (ESP32 + NEO-6M + E32-433T30D)
#pragma once

// Номер трекера (0..99) — у каждого трекера свой
#define DEVICE_ID 1

// Как часто отправлять координаты, мс
#define SEND_INTERVAL_MS 5000

// ---- NEO-6M (UART1) ----
#ifndef GPS_RX_PIN
#define GPS_RX_PIN 32  // <- TX модуля NEO-6M
#endif
#ifndef GPS_TX_PIN
#define GPS_TX_PIN 33  // -> RX модуля NEO-6M
#endif
#define GPS_BAUD 9600

// ---- E32-433T30D (UART2) ----
#ifndef E32_RX_PIN
#define E32_RX_PIN 16   // <- TXD модуля E32
#endif
#ifndef E32_TX_PIN
#define E32_TX_PIN 17   // -> RXD модуля E32
#endif
#ifndef E32_M0_PIN
#define E32_M0_PIN 25
#endif
#ifndef E32_M1_PIN
#define E32_M1_PIN 26
#endif
#ifndef E32_AUX_PIN
#define E32_AUX_PIN 27  // если AUX не подключён, тоже работает (вход с подтяжкой)
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
