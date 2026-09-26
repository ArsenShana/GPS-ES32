// Тесты протокола пакета. Запуск на ПК: pio test -e native
#include <string.h>
#include <unity.h>

#include <string>
#include "GpsProtocol.h"

using namespace gpsproto;

void setUp() {}
void tearDown() {}

static Packet sample() {
  Packet p;
  p.deviceId = 1;
  p.seq = 1234;
  p.fix = true;
  p.lat = 51.128207;
  p.lon = 71.430411;
  p.altM = 347;
  p.speedKmh = 12.3f;
  p.sats = 9;
  p.hdop = 0.9f;
  return p;
}

static void test_roundtrip() {
  char buf[kBufferSize];
  Packet in = sample();
  int n = encode(in, buf, sizeof(buf));
  TEST_ASSERT_GREATER_THAN(0, n);
  TEST_ASSERT_EQUAL_STRING("G,1,1234,1,51.128207,71.430411,347,12.3,9,0.9*", std::string(buf, strchr(buf, '*') + 1).c_str());
  TEST_ASSERT_EQUAL_CHAR('\n', buf[n - 1]);

  Packet out;
  TEST_ASSERT_TRUE(decode(buf, out));
  TEST_ASSERT_EQUAL_UINT8(1, out.deviceId);
  TEST_ASSERT_EQUAL_UINT16(1234, out.seq);
  TEST_ASSERT_TRUE(out.fix);
  TEST_ASSERT_DOUBLE_WITHIN(1e-6, 51.128207, out.lat);
  TEST_ASSERT_DOUBLE_WITHIN(1e-6, 71.430411, out.lon);
  TEST_ASSERT_EQUAL_INT16(347, out.altM);
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 12.3f, out.speedKmh);
  TEST_ASSERT_EQUAL_UINT8(9, out.sats);
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 0.9f, out.hdop);
}

static void test_worst_case_fits_one_e32_subpacket() {
  Packet p;
  p.deviceId = 99;
  p.seq = 65535;
  p.fix = true;
  p.lat = -89.999999;
  p.lon = -179.999999;
  p.altM = -999;
  p.speedKmh = 999.9f;
  p.sats = 99;
  p.hdop = 99.9f;
  char buf[kBufferSize];
  int n = encode(p, buf, sizeof(buf));
  TEST_ASSERT_GREATER_THAN(0, n);
  TEST_ASSERT_LESS_OR_EQUAL(58, n);
  Packet out;
  TEST_ASSERT_TRUE(decode(buf, out));
  TEST_ASSERT_EQUAL_INT16(-999, out.altM);
}

static void test_out_of_range_values_are_clamped() {
  Packet p = sample();
  p.altM = 20000;
  p.hdop = 500.0f;
  p.sats = 200;
  char buf[kBufferSize];
  int n = encode(p, buf, sizeof(buf));
  TEST_ASSERT_GREATER_THAN(0, n);
  Packet out;
  TEST_ASSERT_TRUE(decode(buf, out));
  TEST_ASSERT_EQUAL_INT16(9999, out.altM);
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 99.9f, out.hdop);
  TEST_ASSERT_EQUAL_UINT8(99, out.sats);
}

static void test_corrupted_byte_rejected() {
  char buf[kBufferSize];
  encode(sample(), buf, sizeof(buf));
  Packet out;
  for (size_t i = 0; buf[i] != '*'; i++) {
    char saved = buf[i];
    buf[i] = saved == '5' ? '6' : '5';
    TEST_ASSERT_FALSE_MESSAGE(decode(buf, out), "испорченный байт должен отбрасываться");
    buf[i] = saved;
  }
  TEST_ASSERT_TRUE(decode(buf, out));
}

static void test_garbage_rejected() {
  Packet out;
  TEST_ASSERT_FALSE(decode("", out));
  TEST_ASSERT_FALSE(decode("hello\n", out));
  TEST_ASSERT_FALSE(decode("G,1,2,1*00\n", out));
  TEST_ASSERT_FALSE(decode("$GPGGA,123519,4807.038,N*47\n", out));
  // обрезанный пакет (потеря хвоста в эфире)
  char buf[kBufferSize];
  int n = encode(sample(), buf, sizeof(buf));
  buf[n - 3] = 0;
  TEST_ASSERT_FALSE(decode(buf, out));
}

static void test_crlf_accepted() {
  char buf[kBufferSize];
  int n = encode(sample(), buf, sizeof(buf));
  buf[n - 1] = '\r';
  buf[n] = '\n';
  buf[n + 1] = 0;
  Packet out;
  TEST_ASSERT_TRUE(decode(buf, out));
}

static void test_lost_packets() {
  TEST_ASSERT_EQUAL_UINT16(0, lostBetween(10, 11));
  TEST_ASSERT_EQUAL_UINT16(3, lostBetween(10, 14));
  TEST_ASSERT_EQUAL_UINT16(0, lostBetween(65535, 0));
  TEST_ASSERT_EQUAL_UINT16(1, lostBetween(65535, 1));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_roundtrip);
  RUN_TEST(test_worst_case_fits_one_e32_subpacket);
  RUN_TEST(test_out_of_range_values_are_clamped);
  RUN_TEST(test_corrupted_byte_rejected);
  RUN_TEST(test_garbage_rejected);
  RUN_TEST(test_crlf_accepted);
  RUN_TEST(test_lost_packets);
  return UNITY_END();
}
