import { lookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";

export type PublicAddress = {
  address: string;
  family: 4 | 6;
};

const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, "ipv4");
}

blockedIpv6Addresses.addAddress("::", "ipv6");
blockedIpv6Addresses.addAddress("::1", "ipv6");
blockedIpv6Addresses.addSubnet("::ffff:0:0", 96, "ipv6");
blockedIpv6Addresses.addSubnet("fc00::", 7, "ipv6");
blockedIpv6Addresses.addSubnet("fe80::", 10, "ipv6");
blockedIpv6Addresses.addSubnet("ff00::", 8, "ipv6");
blockedIpv6Addresses.addSubnet("2001:db8::", 32, "ipv6");

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4Addresses.check(address, "ipv4");
  if (family === 6) return !blockedIpv6Addresses.check(address, "ipv6");
  return false;
}

export async function resolvePublicUrl(url: URL): Promise<PublicAddress> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL 只支持 http/https");
  }
  if (url.username || url.password) {
    throw new Error("URL 不允许包含用户名或密码");
  }

  const expectedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port && url.port !== expectedPort) {
    throw new Error("URL 不允许使用非标准端口");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("不支持 localhost 或内网地址");
  }

  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error("不支持 localhost 或内网地址");
    return { address: hostname, family: isIP(hostname) as 4 | 6 };
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((item) => !isPublicAddress(item.address))) {
    throw new Error("不支持 localhost 或内网地址");
  }

  return addresses[0] as PublicAddress;
}

export function createPinnedLookup(resolved: PublicAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [resolved]);
      return;
    }
    callback(null, resolved.address, resolved.family);
  };
}
