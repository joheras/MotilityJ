package motility;

import javax.swing.JFrame;
import javax.swing.JOptionPane;
import javax.swing.GroupLayout;
import javax.swing.GroupLayout.Alignment;
import javax.swing.JPanel;
import javax.swing.JToolBar;
import javax.swing.JButton;
import javax.swing.LayoutStyle.ComponentPlacement;

import ij.IJ;
import ij.ImagePlus;
import ij.WindowManager;
import ij.gui.Roi;
import ij.io.Opener;
import ij.measure.ResultsTable;
import ij.plugin.frame.RoiManager;
import javax.swing.border.EtchedBorder;

import gui.MainGUI;

import java.awt.event.ActionListener;
import java.awt.event.ActionEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.Properties;

public class EditMotilityGUI extends JFrame {
	private String absolutePath;
	private String name;
	private ImagePlus imp;
	private RoiManager rm;
	private JButton btnDeleteRoi;
	private JButton btnAddROI;
	private JButton btnRemoveRegion;
	private JButton btnAddRegion;
	private MainGUI mg;
	
	public EditMotilityGUI(String path, String name,MainGUI mg) {
		this.mg=mg;

		this.absolutePath = path;
		this.name = name;

		addWindowListener(new WindowAdapter() {
			@Override
			public void windowClosed(WindowEvent e) {
				formWindowClosed();
			}
		});
		setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);

		setAlwaysOnTop(true);
		setTitle("Edit GUI");
		setResizable(false);

		JPanel panel = new JPanel();
		panel.setBorder(new EtchedBorder(EtchedBorder.LOWERED, null, null));

		JPanel panel_1 = new JPanel();
		panel_1.setBorder(new EtchedBorder(EtchedBorder.LOWERED, null, null));

		JPanel panel_2 = new JPanel();
		panel_2.setBorder(new EtchedBorder(EtchedBorder.LOWERED, null, null));
		GroupLayout groupLayout = new GroupLayout(getContentPane());
		groupLayout.setHorizontalGroup(groupLayout.createParallelGroup(Alignment.TRAILING)
				.addComponent(panel, GroupLayout.DEFAULT_SIZE, 335, Short.MAX_VALUE)
				.addGroup(groupLayout.createSequentialGroup()
						.addGroup(groupLayout.createParallelGroup(Alignment.TRAILING)
								.addComponent(panel_1, GroupLayout.DEFAULT_SIZE, GroupLayout.DEFAULT_SIZE,
										Short.MAX_VALUE)
								.addComponent(panel_2, GroupLayout.DEFAULT_SIZE, 333, Short.MAX_VALUE))
						.addGap(2)));
		groupLayout.setVerticalGroup(groupLayout.createParallelGroup(Alignment.LEADING)
				.addGroup(groupLayout.createSequentialGroup()
						.addComponent(panel, GroupLayout.PREFERRED_SIZE, 43, GroupLayout.PREFERRED_SIZE)
						.addPreferredGap(ComponentPlacement.RELATED)
						.addComponent(panel_2, GroupLayout.DEFAULT_SIZE, 248, Short.MAX_VALUE)
						.addPreferredGap(ComponentPlacement.RELATED)
						.addComponent(panel_1, GroupLayout.PREFERRED_SIZE, 59, GroupLayout.PREFERRED_SIZE)));

		btnDeleteRoi = new JButton("Delete ROI");
		btnDeleteRoi.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {

				rm.select(0);
				rm.runCommand("Delete");
				rm.select(0);
				rm.runCommand(imp, "Show All");
				btnDeleteRoi.setEnabled(false);
				btnAddRegion.setEnabled(false);
				btnRemoveRegion.setEnabled(false);
				btnAddROI.setEnabled(true);

			}
		});

		btnAddROI = new JButton("AddRoi");
		btnAddROI.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				Roi r1 = imp.getRoi();
				if (r1 != null) {
					rm.addRoi(r1);
					rm.select(0);
					btnDeleteRoi.setEnabled(true);
					btnAddRegion.setEnabled(true);
					btnRemoveRegion.setEnabled(true);
					btnAddROI.setEnabled(false);

				} else {
					final JPanel panel = new JPanel();
					JOptionPane.showMessageDialog(panel, "Select a ROI to add", "Add ROI",
							JOptionPane.INFORMATION_MESSAGE);

				}

			}
		});

		btnRemoveRegion = new JButton("Remove Region");
		btnRemoveRegion.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				Roi r1 = imp.getRoi();
				if (r1 != null) {
					rm.addRoi(r1);
					rm.select(0);
					IJ.run(imp, "Make Inverse", "");
					rm.addRoi(imp.getRoi());
					rm.select(0);
					rm.runCommand(imp, "Delete");
					rm.setSelectedIndexes(new int[] { 0, 1 });
					rm.runCommand(imp, "OR");
					rm.addRoi(imp.getRoi());
					rm.select(0);
					rm.runCommand(imp, "Delete");
					rm.select(0);
					rm.runCommand(imp, "Delete");
					rm.select(0);
					IJ.run(imp, "Make Inverse", "");
					rm.addRoi(imp.getRoi());
					rm.select(0);
					rm.runCommand(imp, "Delete");
					rm.select(0);
				} else {
					final JPanel panel = new JPanel();
					JOptionPane.showMessageDialog(panel, "Select a region to remove from the current roi", "Add region",
							JOptionPane.INFORMATION_MESSAGE);
				}

			}
		});

		btnAddRegion = new JButton("Add Region");
		btnAddRegion.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {

				Roi r1 = imp.getRoi();
				if (r1 != null) {
					rm.addRoi(r1);
					rm.setSelectedIndexes(new int[] { 0, 1 });
					rm.runCommand(imp, "OR");
					rm.addRoi(imp.getRoi());
					rm.select(0);
					rm.runCommand(imp, "Delete");
					rm.select(0);
					rm.runCommand(imp, "Delete");
					rm.select(0);
				} else {
					final JPanel panel = new JPanel();
					JOptionPane.showMessageDialog(panel, "Select a region to add to the current roi", "Remove region",
							JOptionPane.INFORMATION_MESSAGE);
				}

			}
		});
		GroupLayout gl_panel_2 = new GroupLayout(panel_2);
		gl_panel_2.setHorizontalGroup(gl_panel_2.createParallelGroup(Alignment.LEADING)
				.addGroup(gl_panel_2.createSequentialGroup().addContainerGap()
						.addGroup(gl_panel_2.createParallelGroup(Alignment.LEADING)
								.addComponent(btnAddROI, GroupLayout.DEFAULT_SIZE, 309, Short.MAX_VALUE)
								.addComponent(btnDeleteRoi, GroupLayout.DEFAULT_SIZE, 321, Short.MAX_VALUE)
								.addComponent(btnRemoveRegion, GroupLayout.DEFAULT_SIZE, 309, Short.MAX_VALUE)
								.addComponent(btnAddRegion, GroupLayout.DEFAULT_SIZE, 309, Short.MAX_VALUE))
						.addContainerGap()));
		gl_panel_2
				.setVerticalGroup(gl_panel_2.createParallelGroup(Alignment.LEADING)
						.addGroup(gl_panel_2.createSequentialGroup().addContainerGap()
								.addComponent(btnDeleteRoi, GroupLayout.DEFAULT_SIZE, 25, Short.MAX_VALUE)
								.addPreferredGap(ComponentPlacement.RELATED).addComponent(btnAddROI)
								.addPreferredGap(ComponentPlacement.RELATED)
								.addComponent(btnRemoveRegion, GroupLayout.DEFAULT_SIZE, 25, Short.MAX_VALUE)
								.addPreferredGap(ComponentPlacement.RELATED).addComponent(btnAddRegion,
										GroupLayout.DEFAULT_SIZE, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE)
								.addGap(108)));
		panel_2.setLayout(gl_panel_2);

		JButton btnNewButton = new JButton("Save & Exit");
		btnNewButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				closeAndSave();

			}
		});

		JButton btnNewButton_1 = new JButton("Cancel");
		btnNewButton_1.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				formWindowClosed();
			}
		});
		GroupLayout gl_panel_1 = new GroupLayout(panel_1);
		gl_panel_1.setHorizontalGroup(gl_panel_1.createParallelGroup(Alignment.TRAILING).addGroup(Alignment.LEADING,
				gl_panel_1.createSequentialGroup().addGap(103)
						.addComponent(btnNewButton_1, GroupLayout.PREFERRED_SIZE, 91, GroupLayout.PREFERRED_SIZE)
						.addPreferredGap(ComponentPlacement.UNRELATED)
						.addComponent(btnNewButton, GroupLayout.DEFAULT_SIZE, 117, Short.MAX_VALUE).addGap(6)));
		gl_panel_1.setVerticalGroup(gl_panel_1.createParallelGroup(Alignment.LEADING)
				.addGroup(gl_panel_1.createSequentialGroup().addContainerGap()
						.addGroup(gl_panel_1.createParallelGroup(Alignment.BASELINE)
								.addComponent(btnNewButton, GroupLayout.DEFAULT_SIZE, 33, Short.MAX_VALUE)
								.addComponent(btnNewButton_1, GroupLayout.DEFAULT_SIZE, 33, Short.MAX_VALUE))
						.addGap(10)));
		panel_1.setLayout(gl_panel_1);

		JToolBar toolBar = new JToolBar();
		GroupLayout gl_panel = new GroupLayout(panel);
		gl_panel.setHorizontalGroup(gl_panel.createParallelGroup(Alignment.LEADING).addComponent(toolBar,
				GroupLayout.DEFAULT_SIZE, 331, Short.MAX_VALUE));
		gl_panel.setVerticalGroup(gl_panel.createParallelGroup(Alignment.LEADING).addComponent(toolBar,
				GroupLayout.DEFAULT_SIZE, 43, Short.MAX_VALUE));

		JButton btnOvalRoi = new JButton("Oval Roi");
		btnOvalRoi.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				IJ.setTool("oval");
			}
		});
		toolBar.add(btnOvalRoi);

		JButton btnFreeHand = new JButton("Free Hand");
		btnFreeHand.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				IJ.setTool("freehand");
			}
		});
		toolBar.add(btnFreeHand);
		panel.setLayout(gl_panel);
		getContentPane().setLayout(groupLayout);
		
		
		
		File configFile = new File("config.properties");
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
		
		

		imp = IJ.openImage(path + "/images/" + name + ".jpg");
		imp.show();
		Opener o = new Opener();
		rm = new RoiManager();
		rm.setBounds(0, 0, 0, 0);

		if ((new File(path + "/preds/" + name + ".zip")).exists()) {
			o.openZip(path + "/preds/" + name + ".zip");

			// imp2.show();
			// rm.addRoi(imp2.getRoi());
			rm.runCommand(imp, "Show All");

			rm.setVisible(false);
			btnAddROI.setEnabled(false);
		} else {
			btnDeleteRoi.setEnabled(false);
			btnAddRegion.setEnabled(false);
			btnRemoveRegion.setEnabled(false);
		}

		IJ.setTool("freehand");
		setVisible(true);
		pack();
	}

	protected void closeAndSave() {

		Roi r = rm.getRoi(0);
		if (r != null) {

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
			
			Utils.writeCSV(absolutePath, name+".",area,false);
			
			
			
			rm.runCommand(imp, "Draw");
			rm.runCommand("Save", absolutePath + "/preds/" + name + ".zip");
			rm.runCommand(imp, "Delete");
			IJ.saveAs(imp, "JPG", absolutePath + "/preds/" + name + ".jpg");
			mg.refreshSelection();
			formWindowClosed();
		} else {
			final JPanel panel = new JPanel();
			JOptionPane.showMessageDialog(panel, "You need to fix a ROI before exiting", "Fix ROI",
					JOptionPane.INFORMATION_MESSAGE);
		}

	}

	protected void formWindowClosed() {
		imp.changes=false;
		imp.close();

		if (rm != null) {
			rm.close();
		}
		this.dispose();

	}
}
