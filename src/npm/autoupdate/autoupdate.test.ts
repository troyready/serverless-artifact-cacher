import { AutoUpdateHandler } from "./autoupdate";
import { NpmPackage } from "npm/NpmPackage";

describe("AutoupdateHandler", () => {
  let handler: AutoUpdateHandler;
  let listMock: jest.Mock;
  let getNpmPackageMock: jest.Mock;
  let updateRegistryEntryMock: jest.Mock;

  beforeEach(() => {
    listMock = jest.fn();
    getNpmPackageMock = jest.fn();
    updateRegistryEntryMock = jest.fn();
    const app = {
      getNpmPackage: getNpmPackageMock,
      s3Cache: { list: listMock },
    };
    handler = new AutoUpdateHandler(app as any);
  });

  describe("handle", () => {
    test("should handle the request", async () => {
      listMock.mockReturnValue([Promise.resolve("foo")]);
      const npmPackage = { updateRegistryEntry: updateRegistryEntryMock };
      updateRegistryEntryMock.mockResolvedValue("");
      getNpmPackageMock.mockReturnValue(npmPackage);
      const response = await handler.handle(null as any, null as any);
      expect(getNpmPackageMock).toHaveBeenCalledTimes(1);
      expect(getNpmPackageMock).toHaveBeenCalledWith("foo");
      expect(updateRegistryEntryMock).toHaveBeenCalledTimes(1);
      expect(response).toStrictEqual({
        body: JSON.stringify({ message: "done" }),
        statusCode: 200,
      });
    });
  });
});
