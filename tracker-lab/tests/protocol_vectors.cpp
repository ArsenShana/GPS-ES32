// Ground truth for the browser simulator, produced by the real firmware codec.
#include "GpsProtocol.h"
#include <cassert>
#include <cstdio>
int main(){
  gpsproto::Packet p;p.deviceId=1;p.seq=1234;p.fix=true;p.lat=51.128207;p.lon=71.430411;p.altM=347;p.speedKmh=12.3f;p.sats=9;p.hdop=.9f;
  char wire[gpsproto::kBufferSize];assert(gpsproto::encode(p,wire,sizeof(wire))>0);fputs(wire,stdout);
  for(unsigned i=0;i<1000;i++){
    p.seq=i;p.lat=-80+i*.16;p.lon=-170+i*.34;
    assert(gpsproto::encode(p,wire,sizeof(wire))>0);gpsproto::Packet decoded;assert(gpsproto::decode(wire,decoded));fputs(wire,stdout);
  }
}
