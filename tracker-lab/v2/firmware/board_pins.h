#ifndef AT02_BOARD_PINS_H
#define AT02_BOARD_PINS_H
/* STM32L072CBT6 / LQFP48; alternate functions verified in STM32 DS10689.
 * Port driver must configure these with CMSIS/LL and high-impedance GNSS UART
 * when +3V3_GNSS is off. This file does not initialize peripherals. */
#define AT_GNSS_UART "USART1: PA9 TX(AF4), PA10 RX(AF4), 9600 8N1"
#define AT_RADIO_UART "USART2: PA2 TX(AF4), PA3 RX(AF4), 9600 8N1"
#define AT_I2C "I2C1: PB6 SCL(AF1), PB7 SDA(AF1)"
#define AT_RADIO_AUX "PA1"
#define AT_RADIO_M0 "PA4"
#define AT_RADIO_M1 "PA5"
#define AT_RADIO_RESET "PB0"
#define AT_GNSS_ENABLE "PA6"
#define AT_GNSS_PPS "PA7"
#define AT_MOTION_INTERRUPT "PB1 / EXTI1"
#define AT_BATTERY_ADC "PA0 / ADC_IN0 / divider 1M:330k"
#define AT_LED "PB5"
#define AT_CHARGE_EN1 "PB8 / default LOW USB100; HIGH only after permitted USB budget"
#define AT_CHARGE_STATUS "PB9 / active LOW open-drain"
#define AT_USB "PA11 DM, PA12 DP / HSI48 + CRS"
#define AT_SWD "PA13 SWDIO, PA14 SWCLK, NRST"
#endif
