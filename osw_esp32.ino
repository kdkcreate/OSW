#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>
#include "secrets.h"

#define OSW_DHT_PIN 19
#define OSW_DHT_TYPE DHT22
constexpr unsigned long PUBLISH_INTERVAL_MS = 120000;
DHT dht(OSW_DHT_PIN, OSW_DHT_TYPE);
unsigned long lastPublish = 0;

bool publish(const char* feed, float value) {
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  String url = "https://io.adafruit.com/api/v2/" + String(ADAFRUIT_IO_USERNAME) + "/feeds/" + feed + "/data";
  if (!http.begin(client, url)) return false;
  http.addHeader("X-AIO-Key", ADAFRUIT_IO_KEY);
  http.addHeader("Content-Type", "application/json");
  const int status = http.POST("{\"value\":\"" + String(value, 1) + "\"}");
  http.end();
  return status >= 200 && status < 300;
}
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) delay(250);
}
void publishReading() {
  connectWiFi();
  if (WiFi.status() != WL_CONNECTED) return;
  const float temperature = dht.readTemperature(), humidity = dht.readHumidity();
  if (isfinite(temperature)) publish(TEMPERATURE_FEED_KEY, temperature);
  if (isfinite(humidity)) publish(HUMIDITY_FEED_KEY, humidity);
}
void setup() { Serial.begin(115200); dht.begin(); WiFi.mode(WIFI_STA); publishReading(); lastPublish = millis(); }
void loop() { if (millis() - lastPublish >= PUBLISH_INTERVAL_MS) { publishReading(); lastPublish = millis(); } }
