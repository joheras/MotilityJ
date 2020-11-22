package motility;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

import ij.IJ;
import ij.ImageJ;
import ij.ImagePlus;
import interfaces.OpenInterface;

import loci.formats.FormatException;
import loci.plugins.BF;
import loci.plugins.in.ImporterOptions;

public class OpenMotility implements OpenInterface {

	@Override
	public void openFunction(String path) {
		File dir = new File(path + '/');

		if (!(new File(path + "/images/")).exists()) {
			try {
				Files.createDirectories(Paths.get(path + "/images/"));

				String[] ficheros = dir.list();

				// ImageJ ij = new ImageJ();
				// ij.setVisible(false);

				for (int i = 0; i < ficheros.length; i++) {
					File file = new File(path + '/' + ficheros[i]);
					if (file.isFile()) {

						try {
							ImporterOptions options = new ImporterOptions();
							options.setId(path + '/' + ficheros[i]);

							options.setWindowless(true);
							ImagePlus[] imps = BF.openImagePlus(options);

							ImagePlus imp = imps[0];
							imp.show();
							IJ.saveAs(imp, "JPG", path + "/images/"
									+ file.getName().substring(0, file.getName().lastIndexOf(".")) + ".jpg");
							imp.close();
						} catch (FormatException e) {
							// TODO Auto-generated catch block
							e.printStackTrace();
						} catch (IOException e) {
							// TODO Auto-generated catch block
							e.printStackTrace();
						}
					}

				}

			} catch (IOException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
		} 
	}

}
