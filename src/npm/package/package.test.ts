import { PackageHandler } from "./package";
import { NpmPackage } from "npm/NpmPackage";

describe("PackageHandler", () => {
  let handler: PackageHandler;
  let getNpmPackageMock: jest.Mock;
  const event: any = { pathParameters: { proxy: "foo" } };

  beforeEach(() => {
    getNpmPackageMock = jest.fn();
    const app = {
      getNpmPackage: getNpmPackageMock,
    };
    handler = new PackageHandler(app as any);
  });

  describe("handle", () => {
    test("should handle the request", async () => {
      const npmPackage = { getRegistryEntry: jest.fn() };
      npmPackage.getRegistryEntry.mockResolvedValue("bar");
      getNpmPackageMock.mockReturnValue(npmPackage);
      const response = await handler.handle(event, null as any);
      expect(getNpmPackageMock).toHaveBeenCalledWith("foo");
      expect(response).toStrictEqual({
        body: "bar",
        headers: { "Content-Type": "application/vnd.npm.install-v1+json" },
        statusCode: 200,
      });
    });
  });
});
