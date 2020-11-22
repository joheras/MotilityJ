package motility;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Vector;

import javax.swing.JOptionPane;
import javax.swing.JPanel;

import interfaces.ExportExcelInterface;

public class ExportExcelMotility implements ExportExcelInterface {

	@Override
	public void exportExcel(String path) {

		File dir = new File(path + "/images/");
		String[] files = dir.list();

		FileWriter csvWriter;
		try {
			csvWriter = new FileWriter(path + "/result.csv");

			csvWriter.append("File");
			csvWriter.append(",");
			csvWriter.append("Class");
			csvWriter.append(",");
			csvWriter.append("Area (mm^2)");
			csvWriter.append("\n");

			for (String file : files) {

				csvWriter.append(file.substring(0, file.lastIndexOf('.')));

				File inputFile = new File(path + "/preds/" + file.substring(0, file.lastIndexOf('.')) + ".csv");
				try (FileReader fr = new FileReader(inputFile); BufferedReader br = new BufferedReader(fr)) {
					String firstRow = br.readLine().trim();

					// rows
					Object[] tableLines = br.lines().toArray();
					// data rows
					String line = tableLines[0].toString().trim();
					String[] dataRow = line.split(",");
					fr.close();
					csvWriter.append(",");
					csvWriter.append(dataRow[0]);
					csvWriter.append(",");
					csvWriter.append(dataRow[1]);
					csvWriter.append("\n");
				}
			}
			
			csvWriter.flush();
			csvWriter.close();
			

		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

	}

}
