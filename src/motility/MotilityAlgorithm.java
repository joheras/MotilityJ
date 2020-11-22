package motility;

import java.awt.BorderLayout;
import java.awt.Container;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.List;
import java.util.Properties;

import javax.swing.BorderFactory;
import javax.swing.JFrame;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JProgressBar;
import javax.swing.SwingWorker;
import javax.swing.border.Border;

import fiji.selection.Select_Bounding_Box;
import fiji.threshold.Auto_Local_Threshold;
import gui.WaitDialog;
import ij.IJ;
import ij.ImagePlus;
import ij.WindowManager;
import ij.gui.OvalRoi;
import ij.gui.Roi;
import ij.measure.ResultsTable;
import ij.plugin.frame.RoiManager;
import ij.process.ImageStatistics;
import interfaces.AlgorithmInterface;
import loci.formats.FormatException;
import loci.plugins.BF;
import loci.plugins.in.ImporterOptions;

public class MotilityAlgorithm implements AlgorithmInterface {

	private boolean isDark = false;

	@Override
	public boolean applyAlgorithm(final String path) {

		File configFile = new File("config.properties");

		if (!configFile.exists()) {
			ConfigureMotility cf = new ConfigureMotility();
			cf.configure();
		}

		if (!configFile.exists()) {
			final JPanel panel = new JPanel();
			JOptionPane.showMessageDialog(panel, "You must introduce the scale values before the segmentation process",
					"Error", JOptionPane.ERROR_MESSAGE);
			return false;

		} else {

			FileReader reader;
			try {
				reader = new FileReader(configFile);

				Properties props = new Properties();
				props.load(reader);

				ImagePlus imp = IJ.createImage("Untitled", "8-bit white", 1, 1, 1);
				IJ.run(imp, "Set Scale...", "distance=" + props.getProperty("pxScale") + " known="
						+ props.getProperty("mmScale") + " unit=mm global");

			} catch (FileNotFoundException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			} catch (IOException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}

			final WaitDialog wd = new WaitDialog();
			;
			SwingWorker<Void, Void> mySwingWorker = new SwingWorker<Void, Void>() {

				@Override
				protected Void doInBackground() throws Exception {
					applyAlgorithmClassification(path);
					applyAlgorithmSegmentation(path);
					wd.dispose();
					return null;
				}
			};

			mySwingWorker.execute();
			wd.makeWait();

			return true;

		}
	}

	public void applyAlgorithmClassification(String path) {

		new File(path + "/preds").mkdir();

		// For each file in the folder we detect the esferoid on it.
		ProcessBuilder pBuilder = null;

		boolean isWindows = System.getProperty("os.name").toLowerCase().startsWith("windows");

		if (isWindows) {
			pBuilder = new ProcessBuilder("cmd.exe", "/c",
					"deep-motility.exe classification \"" + path.replace("\\", "\\\\") + "\\images\\" + "\" \""
							+ path.replace("\\", "\\\\") + "\"" + "preds");
		} else {
			System.out.println("Linux ");
			pBuilder = new ProcessBuilder("bash", "-c",
					"deep-motility classification '" + path + "/images/" + "' '" + path + "/preds/" + "'");

		}

		Process process;
		try {
			process = pBuilder.start();

			StringBuilder output = new StringBuilder();

			BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()));

			String line;
			while ((line = reader.readLine()) != null) {
				output.append(line + "\n");
			}

			int exitVal = process.waitFor();
			if (exitVal == 0) {
				System.out.println("Success!");
				System.out.println(output);
			} else {
				System.out.println("Error");
				System.out.println("DirName: " + path);
				System.out.println(output);
				System.out.println("Exit Value: " + Integer.toString(exitVal));
				System.out.println("--------ErrorEnd--------");
			}

			File dir = new File(path + "/preds/complete/");
			String[] files = dir.list();

			File configFile = new File("config.properties");
			FileReader reader2 = new FileReader(configFile);
			Properties props = new Properties();
			props.load(reader2);

			// We move the images to the correct folder
			for (String file : files) {
				gui.Utils.copyFile(path + "/preds/complete/" + file,
						path + "/preds/" + file.substring(0, file.lastIndexOf(".")) + ".jpg");

				Utils.writeCSV(path, file, Math.PI * Math.pow(Double.parseDouble(props.getProperty("mmScale")) / 2, 2),
						true);
			}

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (InterruptedException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

	}

	public void applyAlgorithmSegmentation(String path) {

		// For each file in the folder we detect the esferoid on it.
		ProcessBuilder pBuilder = null;

		boolean isWindows = System.getProperty("os.name").toLowerCase().startsWith("windows");

		if (isWindows) {
			pBuilder = new ProcessBuilder("cmd.exe", "/c",
					"deep-motility.exe segmentation \"" + path.replace("\\", "\\\\") + "\\preds\\incomplete" + "\" \""
							+ path.replace("\\", "\\\\") + "\"" + "preds");

		} else {
			System.out.println("Linux ");

			pBuilder = new ProcessBuilder("bash", "-c",
					"deep-motility segmentation '" + path + "/preds/incomplete/" + "' '" + path + "/preds/" + "'");

		}

		Process process;
		try {
			process = pBuilder.start();

			StringBuilder output = new StringBuilder();

			BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()));

			String line;
			while ((line = reader.readLine()) != null) {
				output.append(line + "\n");
			}

			int exitVal = process.waitFor();
			if (exitVal == 0) {
				System.out.println("Success!");
				System.out.println(output);
			} else {
				System.out.println("Error");
				System.out.println("DirName: " + path);
				System.out.println(output);
				System.out.println("Exit Value: " + Integer.toString(exitVal));
				System.out.println("--------ErrorEnd--------");
			}

			File dir = new File(path + "/preds/incomplete/");
			String[] files = dir.list();
			// We move the images to the correct folder
			for (String file : files) {
				String name = file.substring(0, file.lastIndexOf('.'));
				postProcessSegmentation(path + "/preds/incomplete/" + file, path + "/preds/" + name + "_pred.png",
						path + "/preds/");
			}
			//deleteDirectoryRecursionJava6(new File(path + "/preds/complete/"));
			deleteDirectoryRecursionJava6(new File(path + "/preds/incomplete/"));

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (InterruptedException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

	}

	private void deleteDirectoryRecursionJava6(File file) throws IOException {
		if (file.isDirectory()) {
			File[] entries = file.listFiles();
			if (entries != null) {
				for (File entry : entries) {
					deleteDirectoryRecursionJava6(entry);
				}
			}
		}
		if (!file.delete()) {
			throw new IOException("Failed to delete " + file);
		}
	}

	private void postProcessSegmentation(String pathOriginalImage, String pathSegmentation, String outputPath) {

		ImagePlus imp = IJ.openImage(pathSegmentation);
		imp.show();
		IJ.setAutoThreshold(imp, "Default dark");
		IJ.run(imp, "Convert to Mask", "");
		IJ.run(imp, "Analyze Particles...", "add");
		RoiManager rm = RoiManager.getRoiManager();
		rm.setVisible(false);
		Utils.keepBiggestROI(rm);
		Roi r = rm.getRoi(0);
		imp.changes = false;
		imp.close();

		String name = pathOriginalImage.substring(pathOriginalImage.lastIndexOf("/") + 1,
				pathOriginalImage.lastIndexOf("."));

		imp = IJ.openImage(pathOriginalImage);

		IJ.run(imp, "RGB Color", "");
		rm.runCommand("Set Color", "yellow");
		rm.runCommand("Set Line Width", "3");

		imp.setRoi(r);

		rm.runCommand(imp, "Measure");
		IJ.run("Set Measurements...", "area redirect=None decimal=3");
		ResultsTable rt = ResultsTable.getResultsTable();
		double area = rt.getValue("Area", 0);
		rt.reset();
		if (WindowManager.getFrame("Results") != null) {
			IJ.selectWindow("Results");
			IJ.run("Close");
		}
		Utils.writeCSV(outputPath.substring(0, outputPath.lastIndexOf("/pred")), name + ".", area, false);

		rm.runCommand(imp, "Draw");
		rm.runCommand("Save", outputPath + name + ".zip");
		rm.runCommand(imp, "Delete");
		IJ.saveAs(imp, "JPG", outputPath + name + ".jpg");
		rm.close();
		imp.changes = false;
		imp.close();

	}

	@Override
	public boolean applyAlgorithmSingleImage(final String absolutePath,final  String name) {
		final WaitDialog wd = new WaitDialog();
		
		
		
		
		
		SwingWorker<Void, Void> mySwingWorker = new SwingWorker<Void, Void>() {

			@Override
			protected Void doInBackground() throws Exception {
				(new File(absolutePath + "/preds/incomplete/")).mkdir();
				gui.Utils.copyFile(absolutePath+"/images/"+name.substring(0,name.lastIndexOf("."))+".jpg", absolutePath+"/preds/incomplete/"+name.substring(0,name.lastIndexOf("."))+".jpg");
				applyAlgorithmSegmentation(absolutePath);
				wd.dispose();
				return null;
			}
		};

		mySwingWorker.execute();
		wd.makeWait();

		
		return true;
		
	}

}
