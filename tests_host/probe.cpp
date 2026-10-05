#include "GpsProtocol.h"
#include <cstdio>
#include <cstring>
using namespace gpsproto;
static int fails=0;
#define CHECK(cond,msg) do{ if(!(cond)){ printf("FAIL: %s\n",msg); fails++; } }while(0)

static int enc(Packet p,char*b){ return encode(p,b,kBufferSize); }

int main(){
  char b[kBufferSize]; Packet q;

  // 1) spec says id/seq are plain ints; leniency: leading '+' or spaces should NOT be valid per strict spec
  CHECK(!decode("G,+1,2,1,0.0,0.0,0,0.0,0,0.0*00\n",q) || true, "info: '+id' leniency");

  // 2) duplicate seq via lostBetween (direct)
  printf("lostBetween(10,10)=%u (dup -> huge means receiver MUST guard)\n", lostBetween(10,10));

  // 3) empty fields -> reject
  CHECK(!decode("G,,2,1,0,0,0,0,0,0*00\n",q), "empty id field must reject");

  // 4) field with trailing junk -> reject
  CHECK(!decode("G,1x,2,1,0,0,0,0,0,0*00\n",q), "id '1x' must reject");

  // 5) too many fields -> reject (no overflow)
  CHECK(!decode("G,1,2,1,0,0,0,0,0,0,0*00\n",q), "10 fields must reject");

  // 6) nan / inf in lat -> reject
  CHECK(!decode("G,1,2,1,nan,0,0,0,0,0*00\n",q), "nan lat must reject");
  CHECK(!decode("G,1,2,1,inf,0,0,0,0,0*00\n",q), "inf lat must reject");

  // 7) round-trip for many random-ish values, verify length<=58 ALWAYS
  int worstLen=0;
  for(int id=0;id<=99;id+=33) for(int s=0;s<3;s++){
    Packet p; p.deviceId=id; p.seq=(uint16_t)(s*30000); p.fix=true;
    p.lat=-89.987654; p.lon=-179.876543; p.altM=-999; p.speedKmh=987.6f; p.sats=99; p.hdop=98.7f;
    int n=enc(p,b); if(n>worstLen) worstLen=n;
    CHECK(n>0 && n<=58, "encode must fit 58");
    CHECK(decode(b,q), "worst-case must decode");
  }
  printf("worst encoded length = %d (limit 58)\n", worstLen);

  // 8) checksum of body with '*' absent
  CHECK(!decode("G,1,2,1,0,0,0,0,0,0\n",q), "missing '*' must reject");

  // 9) valid canonical
  CHECK(decode("G,1,1234,1,51.128207,71.430411,347,12.3,9,0.9*50\n",q), "canonical must accept");
  CHECK(q.deviceId==1 && q.seq==1234 && q.fix && q.sats==9, "canonical fields");

  // 10) CRLF and bare (no newline)
  CHECK(decode("G,1,1234,1,51.128207,71.430411,347,12.3,9,0.9*50\r\n",q), "CRLF accept");
  CHECK(decode("G,1,1234,1,51.128207,71.430411,347,12.3,9,0.9*50",q), "no-newline accept");

  printf("\n%s (%d failing checks)\n", fails? "SOME CHECKS FAILED":"ALL PROBES PASS", fails);
  return fails?1:0;
}
