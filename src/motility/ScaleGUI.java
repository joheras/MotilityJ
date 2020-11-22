package motility;

import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Toolkit;

import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.GroupLayout;
import javax.swing.GroupLayout.Alignment;
import javax.swing.JTextField;
import javax.swing.LayoutStyle.ComponentPlacement;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Properties;

public class ScaleGUI extends JDialog {

	private final JPanel contentPanel = new JPanel();
	private JTextField textField;
	private JTextField textField_1;

	/**
	 * Create the dialog.
	 * @throws IOException 
	 */
	public ScaleGUI() throws IOException {
		setResizable(false);
		setTitle("Set Scale");
		setBounds(100, 100, 281, 300);
		setModal(true);
		getContentPane().setLayout(new BorderLayout());
		contentPanel.setBorder(new EmptyBorder(5, 5, 5, 5));
		getContentPane().add(contentPanel, BorderLayout.CENTER);

		JLabel lblNewLabel = new JLabel("Diameter in mm:");

		JLabel lblNewLabel_1 = new JLabel("Diameter in pixels:");

		textField = new JTextField();
		textField.setColumns(10);

		textField_1 = new JTextField();
		textField_1.setColumns(10);

		JButton btnNewButton = new JButton("Accept");
		btnNewButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				setScale();
			}
		});
		GroupLayout gl_contentPanel = new GroupLayout(contentPanel);
		gl_contentPanel.setHorizontalGroup(gl_contentPanel.createParallelGroup(Alignment.LEADING)
				.addGroup(gl_contentPanel.createSequentialGroup().addContainerGap()
						.addGroup(gl_contentPanel.createParallelGroup(Alignment.TRAILING)
								.addGroup(gl_contentPanel.createSequentialGroup().addGap(207).addComponent(btnNewButton,
										GroupLayout.DEFAULT_SIZE, GroupLayout.DEFAULT_SIZE, Short.MAX_VALUE))
								.addGroup(gl_contentPanel.createSequentialGroup()
										.addGroup(gl_contentPanel.createParallelGroup(Alignment.LEADING)
												.addComponent(lblNewLabel).addComponent(lblNewLabel_1))
										.addPreferredGap(ComponentPlacement.RELATED, 42, Short.MAX_VALUE)
										.addGroup(gl_contentPanel.createParallelGroup(Alignment.LEADING, false)
												.addComponent(textField, GroupLayout.PREFERRED_SIZE,
														GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE)
												.addComponent(textField_1, GroupLayout.PREFERRED_SIZE,
														GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE))))
						.addGap(29)));
		gl_contentPanel.setVerticalGroup(gl_contentPanel.createParallelGroup(Alignment.LEADING).addGroup(gl_contentPanel
				.createSequentialGroup().addGap(28)
				.addGroup(gl_contentPanel
						.createParallelGroup(Alignment.BASELINE).addComponent(lblNewLabel).addComponent(textField,
								GroupLayout.PREFERRED_SIZE, GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE))
				.addGap(37)
				.addGroup(gl_contentPanel.createParallelGroup(Alignment.BASELINE).addComponent(lblNewLabel_1)
						.addComponent(textField_1, GroupLayout.PREFERRED_SIZE, GroupLayout.DEFAULT_SIZE,
								GroupLayout.PREFERRED_SIZE))
				.addPreferredGap(ComponentPlacement.RELATED, 74, Short.MAX_VALUE).addComponent(btnNewButton)
				.addGap(49)));
		contentPanel.setLayout(gl_contentPanel);
		
		File configFile = new File("config.properties");
		
		if(configFile.exists()) {
			FileReader reader = new FileReader(configFile);
		    Properties props = new Properties();
		    props.load(reader);
			textField.setText(props.getProperty("mmScale"));
			textField_1.setText(props.getProperty("pxScale"));
		}
		
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

		
		pack();
		setVisible(true);
	}

	private void setScale() {

		try {
			double mmScale = Double.parseDouble(textField.getText());
			int pxScale = Integer.parseInt(textField_1.getText());

			if (mmScale > 0 && pxScale > 0) {
				File configFile = new File("config.properties");
				 
				try {
				    Properties props = new Properties();
				    props.setProperty("mmScale", ""+mmScale);
				    props.setProperty("pxScale", ""+pxScale);
				    FileWriter writer = new FileWriter(configFile);
				    props.store(writer, "settings");
				    writer.close();
				} catch (FileNotFoundException ex) {
				    // file does not exist
				} catch (IOException ex) {
				    // I/O error
				}
				this.dispose();

			} else {
				JOptionPane.showMessageDialog(this,
						"Introduce positive numbers",
						"Error", JOptionPane.ERROR_MESSAGE);
			}

		} catch (NumberFormatException ne) {
			JOptionPane.showMessageDialog(this,
					"The scale values must be numbers (a real number in the case of the scale in mm, and an integer in the case of pixels",
					"Error", JOptionPane.ERROR_MESSAGE);
		}

	}
}