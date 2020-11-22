package gui;

import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import javax.swing.GroupLayout;
import javax.swing.GroupLayout.Alignment;
import javax.swing.JToolBar;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JFrame;

import java.awt.event.ActionListener;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.awt.EventQueue;
import java.awt.event.ActionEvent;
import javax.swing.LayoutStyle.ComponentPlacement;
import org.jdesktop.swingx.JXImageView;
import javax.swing.ImageIcon;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;

@SuppressWarnings("serial")
public class TryAlgortihms extends JDialog {

	private JPanel contentPane;
	private JXImageView imageView;
	private String path;
	private String pathImagen;
	private String[] ficheros;
	private int indice = 0;

	/**
	 * Create the frame.
	 */
	public TryAlgortihms(final String path, final String pathImagen) {
		
		setModal(true);
		this.setPath(path);
		this.pathImagen = pathImagen;
		setBounds(100, 100, 450, 300);
		contentPane = new JPanel();
		contentPane.setBorder(new EmptyBorder(5, 5, 5, 5));
		setContentPane(contentPane);

		JPanel panel = new JPanel();
		GroupLayout gl_contentPane = new GroupLayout(contentPane);
		gl_contentPane.setHorizontalGroup(
				gl_contentPane.createParallelGroup(Alignment.LEADING).addGroup(gl_contentPane.createSequentialGroup()
						.addComponent(panel, GroupLayout.DEFAULT_SIZE, 442, Short.MAX_VALUE).addGap(0)));
		gl_contentPane.setVerticalGroup(
				gl_contentPane.createParallelGroup(Alignment.LEADING).addGroup(gl_contentPane.createSequentialGroup()
						.addComponent(panel, GroupLayout.DEFAULT_SIZE, 268, Short.MAX_VALUE).addGap(0)));

		JToolBar toolBar = new JToolBar();

		imageView = new JXImageView();
		try {
			// pass the path to the image select
			File dir = new File(path + "/tmp/");
			ficheros = dir.list();
			imageView.setImage(new File(path + "/tmp/" + ficheros[0]));
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		JButton btnNewButton_1 = new JButton("<");
		btnNewButton_1.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				try {
					lastImg();
				} catch (IOException e1) {
					// TODO Auto-generated catch block
					e1.printStackTrace();
				}
			}
		});

		JButton btnNewButton_2 = new JButton(">");

		btnNewButton_2.addMouseListener(new MouseAdapter() {
			public void mouseClicked(MouseEvent e) {
				try {
					nextImg();
				} catch (IOException e1) {
					// TODO Auto-generated catch block
					e1.printStackTrace();
				}

			}
		});

		GroupLayout gl_panel = new GroupLayout(panel);
		gl_panel.setHorizontalGroup(gl_panel.createParallelGroup(Alignment.LEADING)
				.addComponent(toolBar, GroupLayout.DEFAULT_SIZE, 424, Short.MAX_VALUE)
				.addGroup(gl_panel.createSequentialGroup()
						.addComponent(btnNewButton_1, GroupLayout.PREFERRED_SIZE, 45, GroupLayout.PREFERRED_SIZE)
						.addPreferredGap(ComponentPlacement.RELATED)
						.addComponent(imageView, GroupLayout.DEFAULT_SIZE, 331, Short.MAX_VALUE)
						.addPreferredGap(ComponentPlacement.RELATED)
						.addComponent(btnNewButton_2, GroupLayout.PREFERRED_SIZE, 41, GroupLayout.PREFERRED_SIZE)));
		gl_panel.setVerticalGroup(gl_panel.createParallelGroup(Alignment.LEADING).addGroup(gl_panel
				.createSequentialGroup()
				.addComponent(toolBar, GroupLayout.PREFERRED_SIZE, GroupLayout.DEFAULT_SIZE, GroupLayout.PREFERRED_SIZE)
				.addPreferredGap(ComponentPlacement.RELATED)
				.addGroup(gl_panel.createParallelGroup(Alignment.LEADING)
						.addComponent(imageView, GroupLayout.DEFAULT_SIZE, 222, Short.MAX_VALUE)
						.addComponent(btnNewButton_2, Alignment.TRAILING, GroupLayout.DEFAULT_SIZE, 222,
								Short.MAX_VALUE)
						.addComponent(btnNewButton_1, GroupLayout.DEFAULT_SIZE, 231, Short.MAX_VALUE))));

		JButton btnNewButton = new JButton("Select");
		btnNewButton.addMouseListener(new MouseAdapter() {
			@Override
			public void mouseClicked(MouseEvent e) {
				selectImage();
			}
		});
		btnNewButton.setIcon(new ImageIcon("icons/ok.png"));
		btnNewButton.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent arg0) {
			}
		});
		toolBar.add(btnNewButton);
		panel.setLayout(gl_panel);
		contentPane.setLayout(gl_contentPane);
		setDefaultCloseOperation(DISPOSE_ON_CLOSE);
		pack();
		setVisible(true);
	}

	public String getPath() {
		return path;
	}

	public void setPath(String path) {
		this.path = path;
	}

	private void nextImg() throws IOException {

		indice++;
		if (indice < ficheros.length) {
			imageView.setImage(new File(path + "/tmp/" + ficheros[indice]));

		} else {
			imageView.setImage(new File(path + "/tmp/" + ficheros[0]));
			indice = 0;
		}
	}

	private void lastImg() throws IOException {
		indice--;
		if (indice >= 0) {
			imageView.setImage(new File(path + "/tmp/" + ficheros[indice]));
		} else {
			indice = ficheros.length - 1;
			imageView.setImage(new File(path + "/tmp/" + ficheros[ficheros.length - 1]));
		}
	}

	private void selectImage() {
		Utils.copyFile(path + "/tmp/" + ficheros[indice], pathImagen);
		this.dispose();
	}

	
	

}
