package gui;

import java.awt.EventQueue;
import javax.swing.JFrame;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import javax.swing.table.DefaultTableModel;
import javax.swing.DefaultListModel;
import javax.swing.GroupLayout;
import javax.swing.GroupLayout.Alignment;
import javax.swing.JSplitPane;
import java.awt.Panel;
import javax.swing.JToolBar;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JFileChooser;
import javax.swing.JMenuBar;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JMenu;
import java.awt.List;
import java.awt.event.ActionListener;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.util.Properties;
import java.util.Vector;
import javax.swing.LayoutStyle.ComponentPlacement;
import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;
import javax.swing.JTable;
import javax.swing.ImageIcon;
import org.jdesktop.swingx.JXImageView;

import ij.IJ;
import ij.ImageJ;
import ij.ImagePlus;
import interfaces.AlgorithmInterface;
import interfaces.ConfigureInterface;
import interfaces.ExportExcelInterface;
import interfaces.OpenInterface;
import motility.ConfigureMotility;
import motility.EditMotilityGUI;
import motility.ExportExcelMotility;
import motility.MotilityAlgorithm;
import motility.OpenMotility;
import motility.Utils;

import javax.swing.JScrollPane;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import javax.swing.JCheckBox;
import javax.swing.event.ChangeListener;
import javax.swing.event.ChangeEvent;
import javax.swing.JSeparator;

@SuppressWarnings("serial")
public class MainGUI extends JFrame implements KeyListener {
	// definicion de variables
	private JPanel contentPane;
	private JList list;
	private String absolutePath;
	private JXImageView imageView;
	private JTable table;

	private OpenInterface openinterface = new OpenMotility();
	private AlgorithmInterface algorithmInterface = new MotilityAlgorithm();
	private ConfigureInterface configuration = new ConfigureMotility();
	private ExportExcelInterface excelInterface = new ExportExcelMotility();

	private boolean detectionConducted = false;
	private JButton btnExcel;
	private JButton btnNewButton_5;
	private JButton btnDetection;
	private JButton btnClose;
	private JButton btnEdit;
	private JButton btnNewButton_8;
	private JButton btnNewButton_7;
	private JButton btnNewButton_1;
	private JButton btnNewButton_2;
	protected double scale = 0.75;
	private JButton btnChangeClass;
	private JButton btnNewButton;
	private JCheckBox chckbxViewAnnotation;
	private JMenuItem mntmClose;
	private JMenuItem mntmAnalyse;
	private JMenuItem mntmExcel;
	private JMenuItem mntmSettings;
	private JSeparator separator;
	private JMenuItem mntmExit;
	private JMenu mnHelp;
	private JMenuItem mntmAbout;
	private JMenuItem mntmTutorial;
	private JMenuItem mntmNewMenuItem;

	/**
	 * Launch the application.
	 */
	public static void main(String[] args) {
		EventQueue.invokeLater(new Runnable() {
			public void run() {
				try {

					ImageJ ij = new ImageJ();
					ij.setVisible(false);
					MainGUI frame = new MainGUI();
					// open maximed
					frame.setExtendedState(JFrame.MAXIMIZED_BOTH);
					frame.setVisible(true);
				} catch (Exception e) {
					e.printStackTrace();
				}
			}
		});
	}

	/**
	 * Create the frame.
	 * 
	 * @throws IOException
	 */
	public MainGUI() throws IOException {
		setTitle("MotilidadJ");

		addKeyListener(this);
		setFocusable(true);
		setFocusTraversalKeysEnabled(false);
		setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		setBounds(100, 100, 894, 722);

		JMenuBar menuBar = new JMenuBar();
		setJMenuBar(menuBar);

		JMenu mnNewMenu = new JMenu("Experiment");
		menuBar.add(mnNewMenu);

		mntmNewMenuItem = new JMenuItem("Open");
		mntmNewMenuItem.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				openButtonEvent();
				setFocusable(true);
				setFocusTraversalKeysEnabled(false);
			}
		});
		mnNewMenu.add(mntmNewMenuItem);

		mntmClose = new JMenuItem("Close");
		mntmClose.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				closeButtonClicked();
			}
		});
		mntmClose.setEnabled(false);
		mnNewMenu.add(mntmClose);

		mntmAnalyse = new JMenuItem("Analyse");
		mntmAnalyse.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				try {
					performDetection();
					setFocusable(true);
					setFocusTraversalKeysEnabled(false);
				} catch (IOException e1) {
					// TODO Auto-generated catch block
					e1.printStackTrace();
				}
			}
		});
		mntmAnalyse.setEnabled(false);
		mnNewMenu.add(mntmAnalyse);

		mntmExcel = new JMenuItem("Excel");
		mntmExcel.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				exportToExcel();
			}
		});
		mntmExcel.setEnabled(false);
		mnNewMenu.add(mntmExcel);

		mntmSettings = new JMenuItem("Settings");
		mntmSettings.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				configure();
				setFocusable(true);
				setFocusTraversalKeysEnabled(false);
			}
		});
		mntmSettings.setEnabled(false);
		mnNewMenu.add(mntmSettings);

		separator = new JSeparator();
		mnNewMenu.add(separator);

		mntmExit = new JMenuItem("Exit");
		mntmExit.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				dispose();
			}
		});
		mnNewMenu.add(mntmExit);

		mnHelp = new JMenu("Help");
		menuBar.add(mnHelp);

		mntmTutorial = new JMenuItem("Tutorial");
		mnHelp.add(mntmTutorial);

		mntmAbout = new JMenuItem("About");
		mntmAbout.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				System.out.println("About");
			}
		});
		mnHelp.add(mntmAbout);
		contentPane = new JPanel();
		contentPane.setBorder(new EmptyBorder(5, 5, 5, 5));
		setContentPane(contentPane);

		JToolBar toolBar = new JToolBar();

		btnNewButton = new JButton("");
		btnNewButton.setToolTipText("Open a folder containing the images of the experiment");
		btnNewButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
			}
		});
		btnNewButton.setIcon(new ImageIcon(MainGUI.class.getResource("/icons/folder.png")));
		btnNewButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				openButtonEvent();
				setFocusable(true);
				setFocusTraversalKeysEnabled(false);
			}
		});
		toolBar.add(btnNewButton);

		btnClose = new JButton("");
		btnClose.setIcon(new ImageIcon(MainGUI.class.getResource("/icons/cancel.png")));
		btnClose.setToolTipText("Close current experiment");
		btnClose.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {

				closeButtonClicked();

			}
		});
		btnClose.setEnabled(false);
		toolBar.add(btnClose);

		btnDetection = new JButton("");
		btnDetection.setIcon(new ImageIcon(MainGUI.class.getResource("/icons/computer.png")));
		btnDetection.setToolTipText("Analyse the images of the experiment");
		btnDetection.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				try {
					performDetection();
					setFocusable(true);
					setFocusTraversalKeysEnabled(false);
				} catch (IOException e1) {
					// TODO Auto-generated catch block
					e1.printStackTrace();
				}
			}

		});
		btnDetection.setEnabled(false);
		toolBar.add(btnDetection);

		btnNewButton_5 = new JButton("");
		btnNewButton_5.setToolTipText("Configure the size of the Petri dish");
		btnNewButton_5.setEnabled(false);
		btnNewButton_5.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				configure();
				setFocusable(true);
				setFocusTraversalKeysEnabled(false);
			}
		});
		btnNewButton_5.setIcon(new ImageIcon(MainGUI.class.getResource("/icons/settings.png")));
		toolBar.add(btnNewButton_5);

		btnExcel = new JButton("");
		btnExcel.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				exportToExcel();
			}
		});
		btnExcel.setToolTipText("Export to excel");
		btnExcel.setIcon(new ImageIcon(MainGUI.class.getResource("/icons/excel-file.png")));
		btnExcel.setEnabled(false);
		toolBar.add(btnExcel);

		JSplitPane splitPane_1 = new JSplitPane();

		JPanel panel = new JPanel();
		splitPane_1.setLeftComponent(panel);

		list = new JList();
		list.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				try {

					btnChangeClass.setEnabled(true);
					chckbxViewAnnotation.setEnabled(true);
					mostrarImagen();
					initTable(table);
				} catch (IOException e1) {
					// TODO Auto-generated catch block
					e1.printStackTrace();
				}
				setFocusable(true);
				setFocusTraversalKeysEnabled(false);
			}
		});

		GroupLayout gl_panel = new GroupLayout(panel);
		gl_panel.setHorizontalGroup(gl_panel.createParallelGroup(Alignment.LEADING).addComponent(list,
				GroupLayout.DEFAULT_SIZE, 110, Short.MAX_VALUE));
		gl_panel.setVerticalGroup(gl_panel.createParallelGroup(Alignment.LEADING).addComponent(list,
				GroupLayout.DEFAULT_SIZE, 393, Short.MAX_VALUE));
		panel.setLayout(gl_panel);

		JPanel panel_1 = new JPanel();
		splitPane_1.setRightComponent(panel_1);

		JSplitPane splitPane_2 = new JSplitPane();
		splitPane_2.setOrientation(JSplitPane.VERTICAL_SPLIT);
		GroupLayout gl_panel_1 = new GroupLayout(panel_1);
		gl_panel_1.setHorizontalGroup(gl_panel_1.createParallelGroup(Alignment.LEADING).addComponent(splitPane_2,
				GroupLayout.DEFAULT_SIZE, 439, Short.MAX_VALUE));
		gl_panel_1.setVerticalGroup(gl_panel_1.createParallelGroup(Alignment.LEADING).addComponent(splitPane_2,
				Alignment.TRAILING, GroupLayout.DEFAULT_SIZE, 386, Short.MAX_VALUE));

		JPanel panel_2 = new JPanel();
		splitPane_2.setRightComponent(panel_2);

		splitPane_2.setDividerLocation(0.95);
		splitPane_2.setResizeWeight(0.95);
		JScrollPane scrollPane = new JScrollPane();
		GroupLayout gl_panel_2 = new GroupLayout(panel_2);
		gl_panel_2.setHorizontalGroup(gl_panel_2.createParallelGroup(Alignment.LEADING).addComponent(scrollPane,
				GroupLayout.DEFAULT_SIZE, 665, Short.MAX_VALUE));
		gl_panel_2.setVerticalGroup(gl_panel_2.createParallelGroup(Alignment.LEADING).addComponent(scrollPane,
				GroupLayout.DEFAULT_SIZE, 200, Short.MAX_VALUE));

		table = new JTable();
		scrollPane.setViewportView(table);
		panel_2.setLayout(gl_panel_2);
		JPanel panel_3 = new JPanel();
		splitPane_2.setLeftComponent(panel_3);

		JToolBar toolBar_1 = new JToolBar();

		btnNewButton_1 = new JButton("<");
		btnNewButton_1.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				try {
					previousImg();
				} catch (IOException e1) {
					// TODO Auto-generated catch block
					e1.printStackTrace();
				}
				setFocusable(true);
				setFocusTraversalKeysEnabled(false);
			}
		});
		btnNewButton_2 = new JButton(">");
		btnNewButton_2.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				try {
					nextImg();
				} catch (IOException e1) {
					// TODO Auto-generated catch block
					e1.printStackTrace();
				}
				setFocusable(true);
				setFocusTraversalKeysEnabled(false);
			}
		});

		imageView = new JXImageView();
		// imageView.setImage(new
		// File("C:\\Users\\ancasag\\eclipse-workspace\\prueba\\icons\\settings.png"));
		GroupLayout gl_panel_3 = new GroupLayout(panel_3);
		gl_panel_3.setHorizontalGroup(gl_panel_3.createParallelGroup(Alignment.LEADING)
				.addGroup(gl_panel_3.createSequentialGroup().addComponent(btnNewButton_1)
						.addPreferredGap(ComponentPlacement.RELATED)
						.addComponent(imageView, GroupLayout.DEFAULT_SIZE, 343, Short.MAX_VALUE)
						.addPreferredGap(ComponentPlacement.RELATED).addComponent(btnNewButton_2))
				.addComponent(toolBar_1, GroupLayout.DEFAULT_SIZE, 444, Short.MAX_VALUE));
		gl_panel_3.setVerticalGroup(gl_panel_3.createParallelGroup(Alignment.LEADING).addGroup(gl_panel_3
				.createSequentialGroup()
				.addComponent(
						toolBar_1, GroupLayout.PREFERRED_SIZE, GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE)
				.addPreferredGap(ComponentPlacement.RELATED)
				.addGroup(gl_panel_3.createParallelGroup(Alignment.LEADING)
						.addComponent(imageView, GroupLayout.DEFAULT_SIZE, 284, Short.MAX_VALUE)
						.addComponent(btnNewButton_2, Alignment.TRAILING, GroupLayout.DEFAULT_SIZE, 284,
								Short.MAX_VALUE)
						.addComponent(btnNewButton_1, GroupLayout.DEFAULT_SIZE, 284, Short.MAX_VALUE))));

		btnNewButton_7 = new JButton("");
		btnNewButton_7.setToolTipText("Zoom in");
		btnNewButton_7.setEnabled(false);
		btnNewButton_7.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {

				scale = imageView.getScale();
				scale = scale * 1.25;
				imageView.setScale(scale);
				setFocusable(true);
				setFocusTraversalKeysEnabled(false);

			}
		});

		btnNewButton_7.setIcon(new ImageIcon(MainGUI.class.getResource("/icons/zoom_in1.png")));
		toolBar_1.add(btnNewButton_7);

		btnNewButton_8 = new JButton("");
		btnNewButton_8.setEnabled(false);
		btnNewButton_8.addMouseListener(new MouseAdapter() {

			@Override
			public void mouseClicked(MouseEvent e) {

				scale = imageView.getScale();
				scale = scale * .75;
				imageView.setScale(scale);
				setFocusable(true);
				setFocusTraversalKeysEnabled(false);

			}
		});
		btnNewButton_8.setToolTipText("zoom out");
		btnNewButton_8.setIcon(new ImageIcon(MainGUI.class.getResource("/icons/zoom_out.png")));
		toolBar_1.add(btnNewButton_8);

		btnEdit = new JButton("");
		btnEdit.setIcon(new ImageIcon(MainGUI.class.getResource("/icons/edit.png")));
		btnEdit.setToolTipText("Edit the current selection");
		btnEdit.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				editImage();
			}
		});
		btnEdit.setEnabled(false);
		toolBar_1.add(btnEdit);

		btnChangeClass = new JButton("");
		btnChangeClass.setIcon(new ImageIcon(MainGUI.class.getResource("/icons/exchange.png")));
		btnChangeClass.setToolTipText("Change from complete to incomplete (and viceversa)");
		btnChangeClass.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				try {
					changeClass();
				} catch (IOException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			}
		});
		btnChangeClass.setEnabled(false);
		toolBar_1.add(btnChangeClass);

		chckbxViewAnnotation = new JCheckBox("View annotation");
		chckbxViewAnnotation.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
				try {
					changeImage();
				} catch (IOException e) {
					// TODO Auto-generated catch block
					e.printStackTrace();
				}
			}
		});
		chckbxViewAnnotation.setSelected(true);
		chckbxViewAnnotation.setEnabled(false);
		toolBar_1.add(chckbxViewAnnotation);
		panel_3.setLayout(gl_panel_3);
		panel_1.setLayout(gl_panel_1);
		GroupLayout gl_contentPane = new GroupLayout(contentPane);
		gl_contentPane.setHorizontalGroup(gl_contentPane.createParallelGroup(Alignment.LEADING)
				.addComponent(toolBar, Alignment.TRAILING, GroupLayout.DEFAULT_SIZE, 884, Short.MAX_VALUE)
				.addComponent(splitPane_1, GroupLayout.DEFAULT_SIZE, 884, Short.MAX_VALUE));
		gl_contentPane
				.setVerticalGroup(gl_contentPane.createParallelGroup(Alignment.TRAILING).addGroup(Alignment.LEADING,
						gl_contentPane.createSequentialGroup()
								.addComponent(toolBar, GroupLayout.PREFERRED_SIZE, 31, GroupLayout.PREFERRED_SIZE)
								.addPreferredGap(ComponentPlacement.RELATED)
								.addComponent(splitPane_1, GroupLayout.DEFAULT_SIZE, 624, Short.MAX_VALUE)));
		contentPane.setLayout(gl_contentPane);

		menuBar.revalidate();
		menuBar.repaint();

		File configFile = new File("config.properties");

		if (configFile.exists()) {
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
		}

	}

	protected void closeButtonClicked() {
		// TODO Auto-generated method stub
		DefaultListModel listModel = (DefaultListModel) list.getModel();
		listModel.removeAllElements();
		imageView.setImage(new BufferedImage(300, 200, java.awt.image.BufferedImage.TYPE_INT_ARGB));
		detectionConducted = false;
		DefaultTableModel model = new DefaultTableModel();
		table.setModel(model);
		disableButtons();
		setFocusable(true);
		setFocusTraversalKeysEnabled(false);

	}

	protected void changeClass() throws IOException {
		// TODO Auto-generated method stub

		String name = (String) list.getSelectedValue();
		if (name != null) {
			if ((new File(absolutePath + "/preds/" + name.substring(0, name.lastIndexOf(".")) + ".zip")).exists()) {
				// Change from incomplete to complete
				gui.Utils.copyFile(absolutePath + "/images/" + name.substring(0, name.lastIndexOf(".")) + ".jpg",
						absolutePath + "/preds/" + name.substring(0, name.lastIndexOf(".")) + ".jpg");

				(new File(absolutePath + "/preds/" + name.substring(0, name.lastIndexOf(".")) + ".zip")).delete();

				File configFile = new File("config.properties");
				FileReader reader2 = new FileReader(configFile);
				Properties props = new Properties();
				props.load(reader2);
				Utils.writeCSV(absolutePath, name,
						Math.PI * Math.pow(Double.parseDouble(props.getProperty("mmScale")) / 2, 2), true);

			} else {
				algorithmInterface.applyAlgorithmSingleImage(absolutePath, name);
			}
			mostrarImagen();
			initTable(table);
		} else {
			final JPanel panel = new JPanel();
			JOptionPane.showMessageDialog(panel, "Select an image first", "Select image",
					JOptionPane.INFORMATION_MESSAGE);
		}

	}

	protected void changeImage() throws IOException {
		// TODO Auto-generated method stub
		String name = (String) list.getSelectedValue();
		if (name != null) {
			if (chckbxViewAnnotation.isSelected()
					&& (new File(absolutePath + "/preds/" + name.substring(0, name.lastIndexOf(".")) + ".jpg"))
							.exists()) {
				imageView.setImage(
						new File(absolutePath + "/preds/" + name.substring(0, name.lastIndexOf(".")) + ".jpg"));
			} else {
				imageView.setImage(
						new File(absolutePath + "/images/" + name.substring(0, name.lastIndexOf(".")) + ".jpg"));
			}
			imageView.setScale(scale);
		} else {
			final JPanel panel = new JPanel();
			JOptionPane.showMessageDialog(panel, "Select an image first", "Select image",
					JOptionPane.INFORMATION_MESSAGE);
		}

	}

	protected void editImage() {
		String name = (String) list.getSelectedValue();
		if (name != null) {
			new EditMotilityGUI(absolutePath, name.substring(0, name.lastIndexOf(".")), this);
		}else {
			final JPanel panel = new JPanel();
			JOptionPane.showMessageDialog(panel, "Select an image first", "Select image",
					JOptionPane.INFORMATION_MESSAGE);
		}

	}

	public void refreshSelection() {
		try {
			mostrarImagen();
			initTable(table);
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

	}

	protected void exportToExcel() {
		excelInterface.exportExcel(absolutePath);
		final JPanel panel = new JPanel();
		int reply = JOptionPane.showConfirmDialog(panel, "The excel file has been saved in " + absolutePath+"/result.csv\nDo you want to open the file?", "Saved", JOptionPane.YES_NO_OPTION);
		if(reply == JOptionPane.YES_OPTION) {
			new ExcelViewer(absolutePath+"/result.csv");
		}
		
	}

	private void openButtonEvent() {
		list.removeAll();
		JFileChooser fc = new JFileChooser();
		fc.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
		int returnVal = fc.showOpenDialog(contentPane);
		if (returnVal == JFileChooser.APPROVE_OPTION) {
			System.out.println("You chose to open this directory: " + fc.getSelectedFile().getAbsolutePath());
		}

		absolutePath = fc.getSelectedFile().getAbsolutePath();
		if (absolutePath != null) {
			// System.out.println(fc.getSelectedFile().getAbsolutePath()+'/');

			openinterface.openFunction(fc.getSelectedFile().getAbsolutePath() + '/');

			File dir = new File(fc.getSelectedFile().getAbsolutePath() + '/');
			String[] ficheros = dir.list();

			DefaultListModel<String> dlm = new DefaultListModel<String>();
			for (int x = 0; x < ficheros.length; x++) {
				if (new File(dir.getAbsolutePath() + '/' + ficheros[x]).isFile() && !(ficheros[x].contains(".csv"))) {
					dlm.addElement(ficheros[x]);
				}
			}
			list.setModel(dlm);

			if ((new File(absolutePath + "/preds/")).exists()) {
				detectionConducted = true;
				btnExcel.setEnabled(true);
			}
			enableButtons();
		}
	}

	private void enableButtons() {
		btnClose.setEnabled(true);
		btnDetection.setEnabled(true);
		btnNewButton_5.setEnabled(true);

		btnNewButton_7.setEnabled(true);
		btnNewButton_8.setEnabled(true);
		// btnNewButton_9.setEnabled(true);
		btnEdit.setEnabled(true);
		btnNewButton.setEnabled(false);
		btnChangeClass.setEnabled(true);
		chckbxViewAnnotation.setEnabled(true);
		mntmAnalyse.setEnabled(true);
		mntmClose.setEnabled(true);
		mntmExcel.setEnabled(true);
		mntmSettings.setEnabled(true);
		mntmNewMenuItem.setEnabled(false);

	}

	private void disableButtons() {
		btnClose.setEnabled(false);
		btnDetection.setEnabled(false);
		btnNewButton_5.setEnabled(false);
		btnExcel.setEnabled(false);
		btnNewButton_7.setEnabled(false);
		btnNewButton_8.setEnabled(false);
		// btnNewButton_9.setEnabled(false);
		btnEdit.setEnabled(false);
		btnNewButton.setEnabled(true);
		btnChangeClass.setEnabled(false);
		chckbxViewAnnotation.setEnabled(false);

		mntmAnalyse.setEnabled(false);
		mntmClose.setEnabled(false);
		mntmExcel.setEnabled(false);
		mntmSettings.setEnabled(false);
		mntmNewMenuItem.setEnabled(true);
	}

	private void performDetection() throws IOException {

		detectionConducted = algorithmInterface.applyAlgorithm(absolutePath + '/');

		mostrarImagen();
		initTable(table);
		// wd

	}

	private void mostrarImagen() throws IOException {
		String name = (String) list.getSelectedValue();
		if (name != null) {
			if (detectionConducted && chckbxViewAnnotation.isSelected()) {
				imageView.setImage(
						new File(absolutePath + "/preds/" + name.substring(0, name.lastIndexOf(".")) + ".jpg"));
			} else {
				imageView.setImage(
						new File(absolutePath + "/images/" + name.substring(0, name.lastIndexOf(".")) + ".jpg"));
			}
			imageView.setScale(scale);
		}
	}

	@SuppressWarnings("deprecation")
	private void nextImg() throws IOException {

		if (list.getModel().getSize() > 0) {
			int indice = list.getSelectedIndex() + 1;
			if (indice < list.getModel().getSize()) {
				list.setSelectedIndex(indice);
			} else {
				list.setSelectedIndex(0);
			}
			mostrarImagen();
			if (detectionConducted) {
				initTable(table);
			}
		}
	}

	@SuppressWarnings("deprecation")
	private void previousImg() throws IOException {
		if (list.getModel().getSize() > 0) {
			int indice = list.getSelectedIndex() - 1;
			if (indice >= 0) {
				list.setSelectedIndex(indice);
			} else {
				list.setSelectedIndex(list.getModel().getSize() - 1);
			}

			mostrarImagen();
			if (detectionConducted) {
				initTable(table);
			}
		}
	}

	private void initTable(JTable jTable) {
		String img = (String) list.getSelectedValue();
		String nameIm = img.substring(0, img.lastIndexOf('.'));
		String inputFileName = absolutePath + "/preds/" + nameIm + ".csv";
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
		jTable.setModel(model);
	}

	public void configure() {
		configuration.configure();
	}

	public void keyPressed(KeyEvent e) {
		System.out.println(e.getKeyCode());

		if (e.getKeyCode() == 39) {
			try {
				nextImg();
			} catch (IOException e1) {
				// TODO Auto-generated catch block
				e1.printStackTrace();
			}
		}

		if (e.getKeyCode() == 37) {
			try {
				previousImg();
			} catch (IOException e1) {
				// TODO Auto-generated catch block
				e1.printStackTrace();
			}
		}
		setFocusable(true);
		setFocusTraversalKeysEnabled(false);
	}

	@Override
	public void keyReleased(KeyEvent arg0) {
		// TODO Auto-generated method stub
		// System.out.println(arg0.getKeyCode());
	}

	@Override
	public void keyTyped(KeyEvent arg0) {
		// TODO Auto-generated method stub
		// System.out.println(arg0.getKeyCode());
	}
}
