package gui;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class Utils {
	
	public static boolean copyFile(String fromFile, String toFile) {
		File origin = new File(fromFile);
		File destination = new File(toFile);
		if (origin.exists()) {
			try {
				InputStream in = new FileInputStream(origin);
				OutputStream out = new FileOutputStream(destination);
				// We use a buffer for the copy (Usamos un buffer para la copia).
				byte[] buf = new byte[1024];
				int len;
				while ((len = in.read(buf)) > 0) {
					out.write(buf, 0, len);
				}
				in.close();
				out.close();
				return true;
			} catch (IOException ioe) {
				ioe.printStackTrace();
				return false;
			}
		} else {
			return false;
		}
	}

}
