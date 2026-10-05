// Минимальный Unity-совместимый шим для прогона тестов протокола на хосте g++.
#pragma once
#include <cstdio>
#include <cstring>
#include <cmath>
static int g_fail=0, g_tests=0; static const char* g_name="";
#define UNITY_BEGIN() (g_fail=0,g_tests=0,0)
#define UNITY_END() (printf("\n%d tests, %d failures\n",g_tests,g_fail), g_fail?1:0)
#define RUN_TEST(f) do{ g_name=#f; g_tests++; f(); }while(0)
static void _fail(const char*m){ printf("  [FAIL] %s: %s\n",g_name,m); g_fail++; }
#define TEST_ASSERT_TRUE(c) do{ if(!(c)){_fail("TRUE "#c);return;} }while(0)
#define TEST_ASSERT_FALSE(c) do{ if((c)){_fail("FALSE "#c);return;} }while(0)
#define TEST_ASSERT_FALSE_MESSAGE(c,m) do{ if((c)){_fail(m);return;} }while(0)
#define TEST_ASSERT_GREATER_THAN(a,b) do{ if(!((b)>(a))){_fail("GT "#b">"#a);return;} }while(0)
#define TEST_ASSERT_LESS_OR_EQUAL(a,b) do{ if(!((b)<=(a))){_fail("LE "#b"<="#a);return;} }while(0)
#define TEST_ASSERT_EQUAL_CHAR(a,b) do{ if((a)!=(b)){_fail("CHAR "#a"=="#b);return;} }while(0)
#define TEST_ASSERT_EQUAL_STRING(a,b) do{ if(strcmp((a),(b))!=0){printf("    exp[%s] got[%s]\n",(a),(b));_fail("STRING");return;} }while(0)
#define TEST_ASSERT_EQUAL_UINT8(a,b) do{ if((unsigned)(a)!=(unsigned)(b)){_fail("U8 "#a"=="#b);return;} }while(0)
#define TEST_ASSERT_EQUAL_UINT16(a,b) do{ if((unsigned)(a)!=(unsigned)(b)){_fail("U16 "#a"=="#b);return;} }while(0)
#define TEST_ASSERT_EQUAL_INT16(a,b) do{ if((int)(a)!=(int)(b)){_fail("I16 "#a"=="#b);return;} }while(0)
#define TEST_ASSERT_DOUBLE_WITHIN(d,a,b) do{ if(fabs((double)(a)-(double)(b))>(d)){_fail("DBL "#a"~"#b);return;} }while(0)
#define TEST_ASSERT_FLOAT_WITHIN(d,a,b) do{ if(fabs((double)(a)-(double)(b))>(d)){_fail("FLT "#a"~"#b);return;} }while(0)
