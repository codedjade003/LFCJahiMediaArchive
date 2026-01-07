// lib/b2.ts - Add better error logging
import B2 from "backblaze-b2";

// Initialize B2
export const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID!,
  applicationKey: process.env.B2_APPLICATION_KEY!,
});

// Export the raw B2 instance for direct access if needed
export const b2Instance = b2;

// Track authorization state
let isAuthorized = false;

export const b2Methods = {
  authorize: async () => {
    try {
      const response = await b2.authorize();
      isAuthorized = true;
      console.log("B2 Authorization successful, API URL:", response.data.apiUrl);
      return response;
    } catch (error: any) {
      isAuthorized = false;
      console.error("B2 Authorization failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  },

  getUploadUrl: async (params: { bucketId: string }) => {
    try {
      // Ensure we're authorized
      if (!isAuthorized) {
        await b2.authorize();
      }
      const response = await b2.getUploadUrl(params);
      console.log("B2 getUploadUrl successful:", {
        uploadUrl: response.data.uploadUrl,
        fileId: response.data.fileId
      });
      return response;
    } catch (error: any) {
      console.error("B2 getUploadUrl failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        bucketId: params.bucketId
      });
      throw error;
    }
  },

  uploadFile: async (params: {
    uploadUrl: string;
    uploadAuthToken: string;
    fileName: string;
    data: Buffer;
    mime?: string;
  }) => {
    try {
      console.log("B2 uploadFile starting:", params.fileName);
      const response = await b2.uploadFile(params);
      console.log("B2 uploadFile successful:", {
        fileName: params.fileName,
        size: params.data.length
      });
      return response;
    } catch (error: any) {
      console.error("B2 uploadFile failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        fileName: params.fileName
      });
      throw error;
    }
  },

  getFileInfo: async (params: { fileId: string }) => {
    try {
      // Ensure we're authorized
      if (!isAuthorized) {
        await b2.authorize();
      }
      console.log("B2 getFileInfo for fileId:", params.fileId);
      const response = await b2.getFileInfo(params);
      console.log("B2 getFileInfo successful");
      return response;
    } catch (error: any) {
      console.error("B2 getFileInfo failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        fileId: params.fileId
      });
      throw error;
    }
  },
    // In lib/b2.ts - Make sure this method exists:
  getDownloadAuthorization: async (params: {
    bucketId: string;
    fileNamePrefix: string;
    validDurationInSeconds: number;
  }) => {
    // Ensure we're authorized
    if (!isAuthorized) {
      await b2Methods.authorize();
    }
    return b2.getDownloadAuthorization(params);
  },

  deleteFileVersion: async (params: { fileId: string; fileName: string }) => {
    try {
      // Ensure we're authorized
      if (!isAuthorized) {
        await b2.authorize();
      }
      console.log("B2 deleteFileVersion:", params.fileName);
      const response = await b2.deleteFileVersion(params);
      console.log("B2 deleteFileVersion successful");
      return response;
    } catch (error: any) {
      console.error("B2 deleteFileVersion failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        fileName: params.fileName
      });
      throw error;
    }
  },
};
