package gui;

import javax.swing.JDialog;

import java.awt.Dimension;
import java.awt.Toolkit;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.Vector;

import javax.swing.GroupLayout;
import javax.swing.GroupLayout.Alignment;
import javax.swing.table.DefaultTableModel;
import javax.swing.JScrollPane;
import javax.swing.JTable;

public class ExcelViewer extends JDialog {
	private JTable table;
	
	public ExcelViewer(String path) {
		setAlwaysOnTop(true);
		setTitle("Excel Viewer");
		
		JScrollPane scrollPane = new JScrollPane();
		GroupLayout groupLayout = new GroupLayout(getContentPane());
		groupLayout.setHorizontalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addComponent(scrollPane, Alignment.TRAILING, GroupLayout.DEFAULT_SIZE, 547, Short.MAX_VALUE)
		);
		groupLayout.setVerticalGroup(
			groupLayout.createParallelGroup(Alignment.LEADING)
				.addComponent(scrollPane, Alignment.TRAILING, GroupLayout.DEFAULT_SIZE, 362, Short.MAX_VALUE)
		);
		
		table = new JTable();
		scrollPane.setViewportView(table);
		getContentPane().setLayout(groupLayout);
		
		Dimension dim = Toolkit.getDefaultToolkit().getScreenSize();

		// calculate the new location of the window
		int w = this.getSize().width;
		int h = this.getSize().height;

		int x = (dim.width - w) / 2;
		int y = (dim.height - h) / 2;

		// moves this component to a new location, the top-left corner of
	    // the new location is specified by the x and y
	    // parameters in the coordinate space of this component's parent
		this.setLocation(x, y);
		
		
		
		System.out.println(path);
		String inputFileName = path;
		File inputFile;
		String firstRow;
		Vector<Vector<String>> vectorVectorStringsData = new Vector<Vector<String>>();
		Vector<String> vectorStrings = new Vector<String>();
		Vector<String> vectorColumnIdentifiers = new Vector<String>();
		String[] columnIdentifiers;
		DefaultTableModel model = new DefaultTableModel();

		inputFile = new File(inputFileName);
		try (FileReader fr = new FileReader(inputFile); BufferedReader br = new BufferedReader(fr)) {
			firstRow = br.readLine().trim();
			if (firstRow != null) {
				columnIdentifiers = firstRow.split(",");
				vectorColumnIdentifiers = new Vector<String>();
				for (int j = 0; j < columnIdentifiers.length; j++) {
					vectorColumnIdentifiers.add(columnIdentifiers[j]);
				}
			}
			// rows
			Object[] tableLines = br.lines().toArray();
			// data rows
			for (int i = 0; i < tableLines.length; i++) {
				String line = tableLines[i].toString().trim();
				String[] dataRow = line.split(",");
				vectorStrings = new Vector<String>();
				for (int j = 0; j < dataRow.length; j++) {
					vectorStrings.add(dataRow[j]);
				}
				vectorVectorStringsData.add(vectorStrings);
			}

			fr.close();
		} catch (IOException ioe) {
			System.out.println("error: " + ioe.getMessage());
		}

		model.setDataVector(vectorVectorStringsData, vectorColumnIdentifiers);
		table.setModel(model);
		
		

		
		setVisible(true);
		pack();
	}
}
